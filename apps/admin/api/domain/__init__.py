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
    ErrorResponse,
    Letter,
    LetterListResponse,
    LetterSummary,
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
    "ErrorResponse",
    "Letter",
    "LetterListResponse",
    "LetterSummary",
    "Place",
    "PlacesResponse",
    "ProofreadResponse",
]
