import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd

from config import get_settings
from domain.models import (
    Letter, LetterSummary, Place, ProofreadResponse,
    ErrorResponse, LetterListResponse, PlacesResponse,
    ModernizedLetterEntry, LetterModernizationStatus,
    ModernizationStatusResponse, ModernizedLetterResponse,
    BatchRequest, BatchErrorEntry, BatchStatusResponse, BatchStartResponse,
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
modernized: dict[str, dict] = {}  # letter_id (str) -> {text_modern, timestamp, model}
batches: dict[str, dict] = {}  # batch_id -> {status, total, completed, failed, errors, task}

# Path to the modernized letters JSON file
MODERNIZED_PATH: Path = Path(__file__).parent.parent / "data" / "modernized-letters.json"


def load_modernized() -> dict[str, dict]:
    """Load modernized letters from JSON file."""
    if not MODERNIZED_PATH.exists():
        logger.info(f"No modernized letters file found at {MODERNIZED_PATH}, starting fresh")
        return {}
    try:
        with open(MODERNIZED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"Loaded {len(data)} modernized letters from {MODERNIZED_PATH}")
        return data
    except Exception as e:
        logger.error(f"Failed to load modernized letters: {e}")
        return {}


def save_modernized() -> None:
    """Save modernized letters to JSON file."""
    try:
        MODERNIZED_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(MODERNIZED_PATH, "w", encoding="utf-8") as f:
            json.dump(modernized, f, ensure_ascii=False, indent=2)
        logger.debug(f"Saved {len(modernized)} modernized letters to {MODERNIZED_PATH}")
    except Exception as e:
        logger.error(f"Failed to save modernized letters: {e}")

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
    global letters, places, modernized
    logger.info("Starting Jernkorset API...")
    try:
        places = load_places()
        letters = load_letters()
        modernized = load_modernized()
        logger.info(
            f"API ready with {len(letters)} letters, {len(places)} places, "
            f"{len(modernized)} modernized"
        )
    except DataLoadError as e:
        logger.error(f"Failed to load data: {e.message}")
        raise
    yield
    # Cancel any running batches on shutdown
    for batch_id, batch in batches.items():
        if batch["status"] == "running" and "task" in batch:
            batch["task"].cancel()
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

        # Persist the modernized text
        modernized[str(letter_id)] = {
            "text_modern": modernized_text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": "claude-3-5-haiku-20241022",
        }
        save_modernized()

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

# --- Modernization status and batch endpoints ---

@app.get("/modernized", response_model=ModernizationStatusResponse)
async def get_modernization_status():
    """Get overall modernization status for all letters."""
    total = len(letters)
    letter_statuses = []
    for l in letters:
        lid = str(l["id"])
        entry = modernized.get(lid)
        letter_statuses.append(
            LetterModernizationStatus(
                id=l["id"],
                has_modern=lid in modernized,
                timestamp=entry["timestamp"] if entry else None,
            )
        )
    modernized_count = len(modernized)
    return ModernizationStatusResponse(
        total_letters=total,
        modernized_count=modernized_count,
        remaining=total - modernized_count,
        letters=letter_statuses,
    )


@app.get("/modernized/{letter_id}", response_model=ModernizedLetterResponse, responses={404: {"model": ErrorResponse}})
async def get_modernized_letter(letter_id: int):
    """Get modernized text for a specific letter."""
    # Validate the letter exists
    get_letter(letter_id)

    entry = modernized.get(str(letter_id))
    if entry is None:
        raise LetterNotFoundError(letter_id, len(letters))

    return ModernizedLetterResponse(
        id=letter_id,
        text_modern=entry["text_modern"],
        timestamp=entry["timestamp"],
        model=entry["model"],
    )


async def _run_batch(batch_id: str, letter_ids: list[int], delay_ms: int) -> None:
    """Background task that processes a batch of letters sequentially."""
    from modernizer import modernize

    batch = batches[batch_id]
    for lid in letter_ids:
        if batch["status"] == "cancelled":
            break

        try:
            letter = get_letter(lid)
            modernized_text, _tps = modernize(letter["text"])

            modernized[str(lid)] = {
                "text_modern": modernized_text,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "model": "claude-3-5-haiku-20241022",
            }
            save_modernized()
            batch["completed"] += 1
            logger.info(f"Batch {batch_id}: modernized letter {lid} ({batch['completed']}/{batch['total']})")
        except asyncio.CancelledError:
            batch["status"] = "cancelled"
            return
        except Exception as e:
            batch["failed"] += 1
            batch["errors"].append({"letter_id": lid, "error": str(e)})
            logger.warning(f"Batch {batch_id}: failed letter {lid}: {e}")

        # Delay between requests to avoid rate limits
        if delay_ms > 0 and batch["status"] == "running":
            await asyncio.sleep(delay_ms / 1000.0)

    if batch["status"] == "running":
        batch["status"] = "completed"
    logger.info(f"Batch {batch_id} finished: {batch['completed']} completed, {batch['failed']} failed")


@app.post("/modernize-batch", response_model=BatchStartResponse)
async def start_batch_modernization(request_body: BatchRequest):
    """Start batch modernization of letters. Returns immediately with a batch ID."""
    letter_ids = request_body.letter_ids

    # If no letter_ids provided, process all un-modernized letters
    if not letter_ids:
        letter_ids = [l["id"] for l in letters if str(l["id"]) not in modernized]

    if not letter_ids:
        batch_id = str(uuid.uuid4())[:8]
        batches[batch_id] = {
            "status": "completed",
            "total": 0,
            "completed": 0,
            "failed": 0,
            "errors": [],
        }
        return BatchStartResponse(
            batch_id=batch_id,
            total=0,
            message="No letters to modernize",
        )

    # Validate all letter IDs exist
    for lid in letter_ids:
        get_letter(lid)

    batch_id = str(uuid.uuid4())[:8]
    batches[batch_id] = {
        "status": "running",
        "total": len(letter_ids),
        "completed": 0,
        "failed": 0,
        "errors": [],
    }

    task = asyncio.create_task(_run_batch(batch_id, letter_ids, request_body.delay_ms))
    batches[batch_id]["task"] = task

    return BatchStartResponse(
        batch_id=batch_id,
        total=len(letter_ids),
        message=f"Batch started with {len(letter_ids)} letters",
    )


@app.get("/modernize-batch/{batch_id}", response_model=BatchStatusResponse, responses={404: {"model": ErrorResponse}})
async def get_batch_status(batch_id: str):
    """Check the progress of a batch modernization."""
    batch = batches.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

    return BatchStatusResponse(
        batch_id=batch_id,
        status=batch["status"],
        total=batch["total"],
        completed=batch["completed"],
        failed=batch["failed"],
        errors=[BatchErrorEntry(**e) for e in batch["errors"]],
    )


@app.post("/modernize-batch/{batch_id}/cancel", responses={404: {"model": ErrorResponse}})
async def cancel_batch(batch_id: str):
    """Cancel a running batch modernization."""
    batch = batches.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

    if batch["status"] != "running":
        return {"batch_id": batch_id, "status": batch["status"], "message": "Batch is not running"}

    batch["status"] = "cancelled"
    if "task" in batch:
        batch["task"].cancel()

    return {"batch_id": batch_id, "status": "cancelled", "message": "Batch cancelled"}


@app.get("/export/modernized")
async def export_modernized():
    """Export the full modernized-letters.json for download."""
    return JSONResponse(content=modernized)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
