from fastapi import APIRouter, Body
from typing import Any
import os
from server.agent import start_agent_thread

# He tujhi naveen API chi jaga aahe
router = APIRouter(prefix="/api/custom", tags=["Custom APIs"])

@router.get("/hello")
async def hello_custom() -> dict[str, Any]:
    """Ek simple test endpoint"""
    api_key = os.getenv("GEMINI_API_KEY", "Not found")
    return {
        "message": "Hello from your custom API space!",
        "api_key_configured": api_key != "your_gemini_api_key_here" and api_key != "Not found"
    }


@router.post("/run")
async def run_agent(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Starts the AI code reviewer for a selected task in a background thread."""
    task_name = payload.get("task_name", "easy_001")
    model_name = payload.get("model_name")
    
    # Check if a task is provided
    if not task_name:
        return {"status": "error", "message": "No task_name provided"}
    
    # We trigger the agent in a thread so it doesn't block the FastAPI process
    start_agent_thread(task_name, model_name)
    
    return {
        "status": "started",
        "task_name": task_name,
        "model_name": model_name or "default"
    }

@router.post("/data")
async def receive_data(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Tu tithe tujha logic add karu shakatos"""
    return {"status": "received", "data": payload}
