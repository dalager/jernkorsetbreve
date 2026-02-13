import logging
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd

from config import get_settings
from domain.models import (
    Letter, LetterSummary, Place, ProofreadResponse,
    ErrorResponse, LetterListResponse, PlacesResponse
)
from domain.exceptions import (
    JernkorsetAPIError, LetterNotFoundError, InvalidLetterIdError,
    DataLoadError, ModernizationError, ConfigurationError
)

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format=settings.log_format
)
logger = logging.getLogger(__name__)

# Global data stores
letters: list[dict] = []
places: dict[int, dict] = {}

def load_places() -> dict[int, dict]:
    """Load places from CSV file."""
    settings = get_settings()
    try:
        places_df = pd.read_csv(settings.places_path, encoding="utf-8")
        placedict = {}
        for _, place in places_df.iterrows():
            placedict[int(place["place_id"])] = {
                "id": int(place["place_id"]),
                "name": str(place["name"]),
                "geometry": str(place["geometry"]) if pd.notna(place["geometry"]) else None,
            }
        logger.info(f"Loaded {len(placedict)} places from {settings.places_path}")
        return placedict
    except FileNotFoundError:
        raise DataLoadError(str(settings.places_path), "File not found")
    except Exception as e:
        raise DataLoadError(str(settings.places_path), str(e))

def load_letters() -> list[dict]:
    """Load letters from CSV file."""
    settings = get_settings()
    try:
        letters_df = pd.read_csv(settings.letters_path, encoding="utf-8")
        letters_df["date"] = pd.to_datetime(letters_df["date"])
        letters_df["text"] = letters_df["text"].str.replace("<PARA>", "\n\n")

        global places
        letterobjs = []
        for _, letter in letters_df.iterrows():
            place_name = None
            if pd.notna(letter["place_id"]) and int(letter["place_id"]) in places:
                place_name = places[int(letter["place_id"])]["name"]
            letterobjs.append({
                "id": int(letter["id"]),
                "date": letter["date"],
                "place": place_name,
                "sender": str(letter["sender"]),
                "recipient": str(letter["recipient"]),
                "text": str(letter["text"]),
            })
        logger.info(f"Loaded {len(letterobjs)} letters from {settings.letters_path}")
        return letterobjs
    except FileNotFoundError:
        raise DataLoadError(str(settings.letters_path), "File not found")
    except Exception as e:
        raise DataLoadError(str(settings.letters_path), str(e))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - load data on startup."""
    global letters, places
    logger.info("Starting Jernkorset API...")
    try:
        places = load_places()
        letters = load_letters()
        logger.info(f"API ready with {len(letters)} letters and {len(places)} places")
    except DataLoadError as e:
        logger.error(f"Failed to load data: {e.message}")
        raise
    yield
    logger.info("Shutting down Jernkorset API...")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    logger.debug(f"[{request_id}] {request.method} {request.url.path}")
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Exception handlers
@app.exception_handler(JernkorsetAPIError)
async def jernkorset_error_handler(request: Request, exc: JernkorsetAPIError):
    request_id = getattr(request.state, "request_id", None)
    logger.warning(f"[{request_id}] {exc.error_code}: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error_code=exc.error_code,
            message=exc.message,
            detail=exc.detail,
            request_id=request_id
        ).model_dump()
    )

@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.error(f"[{request_id}] Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error_code="INTERNAL_ERROR",
            message="An unexpected error occurred",
            detail=str(exc) if settings.debug else None,
            request_id=request_id
        ).model_dump()
    )

# Helper function
def get_letter(letter_id: int) -> dict:
    """Get letter by ID with validation."""
    if letter_id < 1:
        raise InvalidLetterIdError(letter_id)
    if letter_id > len(letters):
        raise LetterNotFoundError(letter_id, len(letters))
    return letters[letter_id - 1]

# Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "letters_count": len(letters),
        "places_count": len(places)
    }

@app.get("/", response_model=list[Letter])
async def root():
    """Get all letters with full details."""
    return letters

@app.get("/places", response_model=PlacesResponse)
async def read_places():
    """Get all places."""
    return PlacesResponse(items=places, total=len(places))

@app.get("/letters", response_model=list[LetterSummary])
async def read_letters():
    """Get list of letter summaries."""
    return [
        {
            "id": l["id"],
            "date": l["date"],
            "place": l["place"],
            "sender": l["sender"],
            "recipient": l["recipient"],
        }
        for l in letters
    ]

@app.get("/letters/{letter_id}", response_model=Letter, responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}})
async def read_letter(letter_id: int):
    """Get a single letter by ID."""
    return get_letter(letter_id)

@app.post("/proofread/{letter_id}", response_model=ProofreadResponse, responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}, 502: {"model": ErrorResponse}})
async def proofread_letter(letter_id: int, request: Request):
    """Modernize letter text using AI."""
    from modernizer import modernize

    request_id = getattr(request.state, "request_id", None)
    logger.info(f"[{request_id}] Proofreading letter {letter_id}")

    letter = get_letter(letter_id)

    try:
        modernized_text, tps = modernize(letter["text"])
        logger.info(f"[{request_id}] Modernization complete: {tps:.2f} TPS")
        return ProofreadResponse(
            text=modernized_text,
            tps=tps,
            original_letter_id=letter_id
        )
    except ValueError as e:
        raise ConfigurationError("ANTHROPIC_API_KEY")
    except Exception as e:
        logger.error(f"[{request_id}] Modernization failed: {e}")
        raise ModernizationError(str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
