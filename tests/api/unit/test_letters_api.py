import pytest
from fastapi import status

class TestHealthEndpoint:
    def test_health_check(self, test_client):
        response = test_client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert "letters_count" in data
        assert "places_count" in data

class TestLettersEndpoint:
    def test_get_all_letters(self, test_client):
        response = test_client.get("/letters")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_letter_summary_fields(self, test_client):
        response = test_client.get("/letters")
        data = response.json()
        letter = data["items"][0]
        assert "id" in letter
        assert "date" in letter
        assert "place" in letter
        assert "sender" in letter
        assert "recipient" in letter
        assert "text" not in letter  # Summary should not include text

class TestLetterByIdEndpoint:
    def test_get_letter_by_valid_id(self, test_client):
        response = test_client.get("/letters/1")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == 1
        assert data["sender"] == "Peter"
        assert "text" in data

    def test_get_letter_by_invalid_id_zero(self, test_client):
        response = test_client.get("/letters/0")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["error_code"] == "INVALID_LETTER_ID"

    def test_get_letter_by_invalid_id_negative(self, test_client):
        response = test_client.get("/letters/-1")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["error_code"] == "INVALID_LETTER_ID"

    def test_get_letter_not_found(self, test_client):
        response = test_client.get("/letters/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["error_code"] == "LETTER_NOT_FOUND"
        assert "request_id" in data

    def test_get_letter_with_null_place(self, test_client):
        response = test_client.get("/letters/3")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["place"] is None

class TestPlacesEndpoint:
    def test_get_places(self, test_client):
        response = test_client.get("/places")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 2

class TestRootEndpoint:
    def test_root_returns_all_letters(self, test_client):
        response = test_client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3

class TestErrorResponses:
    def test_error_response_structure(self, test_client):
        response = test_client.get("/letters/999")
        data = response.json()
        assert "error_code" in data
        assert "message" in data
        assert "request_id" in data

    def test_request_id_header(self, test_client):
        response = test_client.get("/letters/1")
        assert "X-Request-ID" in response.headers
