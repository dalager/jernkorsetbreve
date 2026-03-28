"""
Pydantic domain models for the Jernkorset API.

These models define the data structures for letters, places, and API responses.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Place(BaseModel):
    """Geographic place associated with letters."""

    id: int = Field(..., description="Unique place identifier")
    name: str = Field(..., description="Place name")
    geometry: Optional[str] = Field(None, description="WKT geometry string")

    model_config = ConfigDict(from_attributes=True)


class LetterSummary(BaseModel):
    """Letter summary for list endpoints."""

    id: int = Field(..., ge=1, description="Letter ID (1-indexed)")
    date: datetime = Field(..., description="Letter date")
    place: Optional[str] = Field(None, description="Place name where letter was written")
    sender: str = Field(..., description="Letter sender")
    recipient: str = Field(..., description="Letter recipient")

    model_config = ConfigDict(from_attributes=True)


class Letter(LetterSummary):
    """Full letter including text content."""

    text: str = Field(..., description="Full letter text content")


class ProofreadResponse(BaseModel):
    """Response from text modernization/proofreading endpoint."""

    text: str = Field(..., description="Modernized text")
    tps: float = Field(..., ge=0, description="Tokens per second")
    original_letter_id: int = Field(..., ge=1, description="Original letter ID")


class ErrorResponse(BaseModel):
    """Standard API error response."""

    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    detail: Optional[str] = Field(None, description="Additional error details")
    request_id: Optional[str] = Field(None, description="Request tracking ID")


class LetterListResponse(BaseModel):
    """Paginated list of letter summaries."""

    items: list[LetterSummary]
    total: int = Field(..., ge=0, description="Total number of letters")


class PlacesResponse(BaseModel):
    """Response containing all places."""

    items: dict[int, Place]
    total: int = Field(..., ge=0, description="Total number of places")


class ModernizedLetterEntry(BaseModel):
    """A single modernized letter stored on disk."""

    text_modern: str = Field(..., description="Modernized text")
    timestamp: str = Field(..., description="ISO timestamp of modernization")
    model: str = Field(..., description="Model used for modernization")


class LetterModernizationStatus(BaseModel):
    """Modernization status for a single letter."""

    id: int = Field(..., ge=1, description="Letter ID")
    has_modern: bool = Field(..., description="Whether letter has been modernized")
    timestamp: Optional[str] = Field(None, description="Modernization timestamp if available")


class ModernizationStatusResponse(BaseModel):
    """Overall modernization status response."""

    total_letters: int = Field(..., ge=0)
    modernized_count: int = Field(..., ge=0)
    remaining: int = Field(..., ge=0)
    letters: list[LetterModernizationStatus]


class ModernizedLetterResponse(BaseModel):
    """Response for a single modernized letter."""

    id: int = Field(..., ge=1)
    text_modern: str
    timestamp: str
    model: str


class BatchRequest(BaseModel):
    """Request to start a batch modernization."""

    letter_ids: list[int] = Field(default_factory=list, description="Letter IDs to modernize (empty = all unmodernized)")
    delay_ms: int = Field(default=500, ge=0, le=60000, description="Delay between requests in milliseconds")


class BatchErrorEntry(BaseModel):
    """A single error that occurred during batch processing."""

    letter_id: int
    error: str


class BatchStatusResponse(BaseModel):
    """Response for batch modernization progress."""

    batch_id: str
    status: str = Field(..., description="running, completed, cancelled, or failed")
    total: int = Field(..., ge=0)
    completed: int = Field(..., ge=0)
    failed: int = Field(..., ge=0)
    errors: list[BatchErrorEntry] = Field(default_factory=list)


class BatchStartResponse(BaseModel):
    """Response when a batch modernization is started."""

    batch_id: str
    total: int
    message: str
