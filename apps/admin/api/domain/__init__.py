"""
Domain models and exceptions for the Jernkorset API.
"""

from .exceptions import (
    ConfigurationError,
    DataLoadError,
    InvalidLetterIdError,
    JernkorsetAPIError,
    LetterNotFoundError,
    ModernizationError,
    PlaceNotFoundError,
)
from .models import (
    BatchErrorEntry,
    BatchRequest,
    BatchStartResponse,
    BatchStatusResponse,
    ErrorResponse,
    Letter,
    LetterListResponse,
    LetterModernizationStatus,
    LetterSummary,
    ModernizedLetterEntry,
    ModernizedLetterResponse,
    ModernizationStatusResponse,
    Place,
    PlacesResponse,
    ProofreadResponse,
)

__all__ = [
    # Exceptions
    "ConfigurationError",
    "DataLoadError",
    "InvalidLetterIdError",
    "JernkorsetAPIError",
    "LetterNotFoundError",
    "ModernizationError",
    "PlaceNotFoundError",
    # Models
    "BatchErrorEntry",
    "BatchRequest",
    "BatchStartResponse",
    "BatchStatusResponse",
    "ErrorResponse",
    "Letter",
    "LetterListResponse",
    "LetterModernizationStatus",
    "LetterSummary",
    "ModernizedLetterEntry",
    "ModernizedLetterResponse",
    "ModernizationStatusResponse",
    "Place",
    "PlacesResponse",
    "ProofreadResponse",
]
