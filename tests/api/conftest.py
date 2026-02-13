"""
Pytest fixtures for Jernkorset API tests.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path
from datetime import datetime

# Add api directory to path
api_dir = Path(__file__).parent.parent.parent / "webapp" / "api"
sys.path.insert(0, str(api_dir))


@pytest.fixture
def mock_places():
    """Mock places data."""
    return {
        1: {"id": 1, "name": "Kobenhavn", "geometry": "POINT(12.5683 55.6761)"},
        2: {"id": 2, "name": "Berlin", "geometry": "POINT(13.4050 52.5200)"},
    }


@pytest.fixture
def mock_letters():
    """Mock letters data."""
    return [
        {
            "id": 1,
            "date": datetime(1914, 8, 1),
            "place": "Kobenhavn",
            "sender": "Peter",
            "recipient": "Trine",
            "text": "Kaere Trine, jeg haaber du har det godt.",
        },
        {
            "id": 2,
            "date": datetime(1914, 8, 15),
            "place": "Berlin",
            "sender": "Peter",
            "recipient": "Moder",
            "text": "Kaere Moder, alt er vel her.",
        },
        {
            "id": 3,
            "date": datetime(1914, 9, 1),
            "place": None,
            "sender": "Peter",
            "recipient": "Fader",
            "text": "Kaere Fader, tak for brevet.",
        },
    ]


@pytest.fixture
def test_client(mock_letters, mock_places):
    """Create test client with mocked data."""
    # Remove cached main module to ensure fresh import
    modules_to_remove = [k for k in sys.modules if k.startswith("main") or k.startswith("domain") or k.startswith("config")]
    for mod in modules_to_remove:
        sys.modules.pop(mod, None)

    # Create mock modernizer module
    mock_modernizer = MagicMock()
    mock_modernizer.modernize = MagicMock(return_value=("Modernized text", 100.0))
    sys.modules["modernizer"] = mock_modernizer

    # Patch the data loading functions
    with patch.object(sys.modules.get("pandas", MagicMock()), "read_csv"):
        # Import after patching
        import main

        # Override global data stores
        main.letters = mock_letters
        main.places = mock_places

        # Create test client with lifespan disabled for testing
        with TestClient(main.app, raise_server_exceptions=True) as client:
            yield client


@pytest.fixture
def test_client_empty():
    """Create test client with empty data."""
    modules_to_remove = [k for k in sys.modules if k.startswith("main") or k.startswith("domain") or k.startswith("config")]
    for mod in modules_to_remove:
        sys.modules.pop(mod, None)

    mock_modernizer = MagicMock()
    sys.modules["modernizer"] = mock_modernizer

    with patch.object(sys.modules.get("pandas", MagicMock()), "read_csv"):
        import main
        main.letters = []
        main.places = {}

        with TestClient(main.app, raise_server_exceptions=True) as client:
            yield client
