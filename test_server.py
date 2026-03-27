import os
import pytest
from unittest.mock import patch, MagicMock
import sys

# Add the project root to the path to allow importing 'server'
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server import app as flask_app


@pytest.fixture
def app():
    yield flask_app


@pytest.fixture
def client(app):
    return app.test_client()


def test_get_games(client, mocker):
    """Test the /games endpoint."""
    mock_games_data = [
        {"id": "test_game", "name": "Test Game", "description": "A test game."}
    ]
    mocker.patch("server.get_dataset_games", return_value=mock_games_data)

    response = client.get("/games")
    assert response.status_code == 200
    assert response.json == mock_games_data


def test_generate_code_success(client, mocker):
    """Test successful code generation via /generate."""
    # Mock the genai client and its response
    mock_response = MagicMock()
    mock_response.text = "```python\nprint('hello world')\n```"
    mock_client_instance = MagicMock()
    mock_client_instance.models.generate_content.return_value = mock_response
    mocker.patch("server.genai.Client", return_value=mock_client_instance)

    # Set a dummy API key
    mocker.patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"})

    # Mock file reading for system prompt
    mocker.patch("builtins.open", mocker.mock_open(read_data="System prompt"))

    response = client.post("/generate", json={"prompt": "a test prompt"})

    assert response.status_code == 200
    assert response.json == {"code": "print('hello world')"}


def test_generate_code_no_prompt(client):
    """Test /generate endpoint without a prompt."""
    response = client.post("/generate", json={"prompt": ""})
    assert response.status_code == 400
    assert "error" in response.json
    assert response.json["error"] == "No prompt provided"


def test_generate_code_no_api_key(client, mocker):
    """Test /generate endpoint without an API key."""
    mocker.patch.dict(os.environ, clear=True)
    response = client.post("/generate", json={"prompt": "a test prompt"})
    assert response.status_code == 500
    assert "error" in response.json
    assert "GEMINI_API_KEY not set" in response.json["error"]


def test_generate_code_unsupported_service(client):
    """Test /generate with an unsupported service."""
    response = client.post(
        "/generate", json={"prompt": "a test prompt", "service": "claude"}
    )
    assert response.status_code == 400
    assert "not currently implemented" in response.json["error"]


def test_visualize_success(client, mocker):
    """Test successful visualization via /visualize."""
    mocker.patch("subprocess.run", return_value=MagicMock(returncode=0))
    mocker.patch("server.generate_svg")
    mocker.patch("builtins.open", mocker.mock_open(read_data="<svg></svg>"))

    code = "import pygambit as g\ngame = g.Game.new_table([2,2])"
    response = client.post("/visualize", json={"code": code})

    assert response.status_code == 200
    assert response.json == {"svg": "<svg></svg>"}


def test_visualize_no_game_object(client):
    """Test /visualize when the code doesn't create a 'game' object."""
    code = "x = 1"
    response = client.post("/visualize", json={"code": code})
    assert response.status_code == 400
    assert "did not produce a 'game' variable" in response.json["error"]


def test_compute_nash_success(client, mocker):
    """Test successful Nash computation."""
    mock_queue = MagicMock()
    mock_queue.empty.return_value = False
    mock_queue.get.return_value = {"results": "NE 1: ..."}

    mock_process = MagicMock()
    mock_process.exitcode = 0

    mocker.patch("multiprocessing.Queue", return_value=mock_queue)
    mocker.patch("multiprocessing.Process", return_value=mock_process)

    code = "import pygambit as g\ngame = g.Game.new_table([2,2])"
    response = client.post(
        "/compute-nash", json={"code": code, "algorithm": "enumpure", "task_id": "123"}
    )

    assert response.status_code == 200
    assert response.json == {"results": "NE 1: ..."}
    mock_process.start.assert_called_once()
    mock_process.join.assert_called_once()


def test_kill_nash(client, mocker):
    """Test killing a running Nash computation."""
    mock_process = MagicMock()
    mock_process.is_alive.return_value = True
    mocker.patch.dict("server.RUNNING_TASKS", {"123": mock_process})

    response = client.post("/kill-nash", json={"task_id": "123"})

    assert response.status_code == 200
    assert response.json == {"status": "terminated"}
    mock_process.terminate.assert_called_once()
