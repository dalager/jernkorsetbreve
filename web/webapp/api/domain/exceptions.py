"""Custom exception classes for the Jernkorset API."""

from typing import Optional


class JernkorsetAPIError(Exception):
    """Base exception for all API errors."""

    def __init__(
        self,
        error_code: str,
        message: str,
        detail: Optional[str] = None,
        status_code: int = 500,
    ):
        self.error_code = error_code
        self.message = message
        self.detail = detail
        self.status_code = status_code
        super().__init__(message)


class LetterNotFoundError(JernkorsetAPIError):
    """Raised when a letter ID doesn't exist."""

    def __init__(self, letter_id: int, total_letters: int):
        super().__init__(
            error_code="LETTER_NOT_FOUND",
            message=f"Letter with ID {letter_id} not found",
            detail=f"Valid letter IDs are 1-{total_letters}",
            status_code=404,
        )


class InvalidLetterIdError(JernkorsetAPIError):
    """Raised when letter ID is invalid (e.g., negative, zero)."""

    def __init__(self, letter_id: int):
        super().__init__(
            error_code="INVALID_LETTER_ID",
            message=f"Invalid letter ID: {letter_id}",
            detail="Letter ID must be a positive integer",
            status_code=400,
        )


class PlaceNotFoundError(JernkorsetAPIError):
    """Raised when a place ID doesn't exist."""

    def __init__(self, place_id: int):
        super().__init__(
            error_code="PLACE_NOT_FOUND",
            message=f"Place with ID {place_id} not found",
            status_code=404,
        )


class DataLoadError(JernkorsetAPIError):
    """Raised when CSV data cannot be loaded."""

    def __init__(self, file_path: str, detail: Optional[str] = None):
        super().__init__(
            error_code="DATA_LOAD_ERROR",
            message=f"Failed to load data from {file_path}",
            detail=detail,
            status_code=500,
        )


class ModernizationError(JernkorsetAPIError):
    """Raised when text modernization fails."""

    def __init__(self, detail: Optional[str] = None):
        super().__init__(
            error_code="MODERNIZATION_ERROR",
            message="Failed to modernize letter text",
            detail=detail,
            status_code=502,
        )


class ConfigurationError(JernkorsetAPIError):
    """Raised when required configuration is missing."""

    def __init__(self, config_key: str):
        super().__init__(
            error_code="CONFIGURATION_ERROR",
            message=f"Missing required configuration: {config_key}",
            status_code=500,
        )
