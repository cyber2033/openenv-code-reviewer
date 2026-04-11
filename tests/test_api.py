import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add the server directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "code-review-env")))

from server.main import app

client = TestClient(app)
HEADERS = {"X-API-Key": "openenv_secret_key_123"}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_reset_episode():
    response = client.post("/reset", json={"task_name": "easy_001"}, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "observation" in data
    assert data["observation"]["task_name"] == "easy_001"
    assert data["observation"]["step"] == 0

def test_step_logic():
    # First reset
    client.post("/reset", json={"task_name": "easy_001"}, headers=HEADERS)
    
    # Take a step
    payload = {
        "line": 1,
        "severity": "medium",
        "category": "logic",
        "message": "Potential bug",
        "fix": "fix it",
        "done": False
    }
    response = client.post("/step", json=payload, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "reward" in data
    assert "observation" in data
    assert data["observation"]["step"] == 1

def test_leaderboard():
    payload = {
        "agent_name": "TestAgent",
        "task": "easy_001",
        "score": 0.85,
        "steps": 2,
        "model": "gpt-4o-mini"
    }
    response = client.post("/leaderboard/submit", json=payload, headers=HEADERS)
    assert response.status_code == 200
    
    response = client.get("/leaderboard")
    assert response.status_code == 200
    lb = response.json()
    assert any(item["agent_name"] == "TestAgent" for item in lb)
