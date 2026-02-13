import pytest
import sys
from pathlib import Path

api_dir = Path(__file__).parent.parent.parent.parent / "webapp" / "api"
sys.path.insert(0, str(api_dir))

from domain.exceptions import (
    JernkorsetAPIError, LetterNotFoundError, InvalidLetterIdError,
    DataLoadError, ModernizationError, ConfigurationError, PlaceNotFoundError
)

class TestJernkorsetAPIError:
    def test_base_error_attributes(self):
        error = JernkorsetAPIError(
            error_code="BASE_ERROR",
            message="Base error message",
            detail="Some detail",
            status_code=500
        )
        assert error.error_code == "BASE_ERROR"
        assert error.message == "Base error message"
        assert error.detail == "Some detail"
        assert error.status_code == 500

    def test_base_error_default_status_code(self):
        error = JernkorsetAPIError(
            error_code="DEFAULT_STATUS",
            message="Default status test"
        )
        assert error.status_code == 500

    def test_base_error_is_exception(self):
        error = JernkorsetAPIError(
            error_code="EXCEPTION_TEST",
            message="Test exception"
        )
        assert isinstance(error, Exception)

    def test_base_error_str_representation(self):
        error = JernkorsetAPIError(
            error_code="STR_TEST",
            message="String representation test"
        )
        assert str(error) == "String representation test"

class TestLetterNotFoundError:
    def test_error_attributes(self):
        error = LetterNotFoundError(999, 666)
        assert error.error_code == "LETTER_NOT_FOUND"
        assert error.status_code == 404
        assert "999" in error.message
        assert "666" in error.detail

    def test_error_message_format(self):
        error = LetterNotFoundError(42, 100)
        assert "42" in error.message
        assert "1-100" in error.detail

    def test_error_inherits_from_base(self):
        error = LetterNotFoundError(1, 10)
        assert isinstance(error, JernkorsetAPIError)
        assert isinstance(error, Exception)

class TestInvalidLetterIdError:
    def test_error_attributes(self):
        error = InvalidLetterIdError(-1)
        assert error.error_code == "INVALID_LETTER_ID"
        assert error.status_code == 400
        assert "-1" in error.message

    def test_error_with_zero(self):
        error = InvalidLetterIdError(0)
        assert "0" in error.message
        assert error.detail == "Letter ID must be a positive integer"

    def test_error_inherits_from_base(self):
        error = InvalidLetterIdError(0)
        assert isinstance(error, JernkorsetAPIError)

class TestPlaceNotFoundError:
    def test_error_attributes(self):
        error = PlaceNotFoundError(999)
        assert error.error_code == "PLACE_NOT_FOUND"
        assert error.status_code == 404
        assert "999" in error.message

    def test_error_inherits_from_base(self):
        error = PlaceNotFoundError(1)
        assert isinstance(error, JernkorsetAPIError)

class TestDataLoadError:
    def test_error_attributes(self):
        error = DataLoadError("/path/to/file.csv", "File not found")
        assert error.error_code == "DATA_LOAD_ERROR"
        assert error.status_code == 500
        assert "file.csv" in error.message

    def test_error_with_detail(self):
        error = DataLoadError("/data/letters.csv", "Permission denied")
        assert "Permission denied" in error.detail

    def test_error_without_detail(self):
        error = DataLoadError("/data/letters.csv")
        assert error.detail is None

    def test_error_inherits_from_base(self):
        error = DataLoadError("/path", "error")
        assert isinstance(error, JernkorsetAPIError)

class TestModernizationError:
    def test_error_attributes(self):
        error = ModernizationError("API timeout")
        assert error.error_code == "MODERNIZATION_ERROR"
        assert error.status_code == 502
        assert "API timeout" in error.detail

    def test_error_message(self):
        error = ModernizationError()
        assert error.message == "Failed to modernize letter text"

    def test_error_without_detail(self):
        error = ModernizationError()
        assert error.detail is None

    def test_error_inherits_from_base(self):
        error = ModernizationError("test")
        assert isinstance(error, JernkorsetAPIError)

class TestConfigurationError:
    def test_error_attributes(self):
        error = ConfigurationError("OPENAI_API_KEY")
        assert error.error_code == "CONFIGURATION_ERROR"
        assert error.status_code == 500
        assert "OPENAI_API_KEY" in error.message

    def test_error_message_format(self):
        error = ConfigurationError("DATABASE_URL")
        assert "Missing required configuration" in error.message
        assert "DATABASE_URL" in error.message

    def test_error_inherits_from_base(self):
        error = ConfigurationError("TEST_KEY")
        assert isinstance(error, JernkorsetAPIError)
