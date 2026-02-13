import pytest
from datetime import datetime
import sys
from pathlib import Path

api_dir = Path(__file__).parent.parent.parent.parent / "webapp" / "api"
sys.path.insert(0, str(api_dir))

from domain.models import Letter, LetterSummary, Place, ErrorResponse, ProofreadResponse

class TestLetterModel:
    def test_letter_creation(self):
        letter = Letter(
            id=1,
            date=datetime(1914, 8, 1),
            place="Kobenhavn",
            sender="Peter",
            recipient="Trine",
            text="Test text"
        )
        assert letter.id == 1
        assert letter.sender == "Peter"
        assert letter.text == "Test text"

    def test_letter_optional_place(self):
        letter = Letter(
            id=1,
            date=datetime(1914, 8, 1),
            place=None,
            sender="Peter",
            recipient="Trine",
            text="Test text"
        )
        assert letter.place is None

    def test_letter_id_validation(self):
        with pytest.raises(ValueError):
            Letter(
                id=0,  # Must be >= 1
                date=datetime(1914, 8, 1),
                place=None,
                sender="Peter",
                recipient="Trine",
                text="Test text"
            )

class TestLetterSummaryModel:
    def test_letter_summary_creation(self):
        summary = LetterSummary(
            id=1,
            date=datetime(1914, 8, 1),
            place="Berlin",
            sender="Peter",
            recipient="Trine"
        )
        assert summary.id == 1
        assert summary.place == "Berlin"
        assert not hasattr(summary, 'text') or 'text' not in summary.model_fields

    def test_letter_summary_id_validation(self):
        with pytest.raises(ValueError):
            LetterSummary(
                id=-1,  # Must be >= 1
                date=datetime(1914, 8, 1),
                place=None,
                sender="Peter",
                recipient="Trine"
            )

class TestPlaceModel:
    def test_place_creation(self):
        place = Place(
            id=1,
            name="Kobenhavn",
            geometry="POINT(12.5683 55.6761)"
        )
        assert place.id == 1
        assert place.name == "Kobenhavn"
        assert place.geometry == "POINT(12.5683 55.6761)"

    def test_place_optional_geometry(self):
        place = Place(
            id=1,
            name="Unknown Location",
            geometry=None
        )
        assert place.geometry is None

class TestProofreadResponseModel:
    def test_proofread_response_creation(self):
        response = ProofreadResponse(
            text="Modernized text here",
            tps=125.5,
            original_letter_id=1
        )
        assert response.text == "Modernized text here"
        assert response.tps == 125.5
        assert response.original_letter_id == 1

    def test_proofread_response_tps_validation(self):
        with pytest.raises(ValueError):
            ProofreadResponse(
                text="Test",
                tps=-1.0,  # Must be >= 0
                original_letter_id=1
            )

    def test_proofread_response_letter_id_validation(self):
        with pytest.raises(ValueError):
            ProofreadResponse(
                text="Test",
                tps=100.0,
                original_letter_id=0  # Must be >= 1
            )

class TestErrorResponseModel:
    def test_error_response_creation(self):
        error = ErrorResponse(
            error_code="TEST_ERROR",
            message="Test message",
            detail="Test detail",
            request_id="abc123"
        )
        assert error.error_code == "TEST_ERROR"
        assert error.message == "Test message"

    def test_error_response_optional_fields(self):
        error = ErrorResponse(
            error_code="TEST_ERROR",
            message="Test message"
        )
        assert error.detail is None
        assert error.request_id is None

    def test_error_response_with_only_required_fields(self):
        error = ErrorResponse(
            error_code="MINIMAL_ERROR",
            message="Minimal error message"
        )
        assert error.error_code == "MINIMAL_ERROR"
        assert error.message == "Minimal error message"
        assert error.detail is None
        assert error.request_id is None
