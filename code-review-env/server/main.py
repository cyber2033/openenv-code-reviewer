import asyncio
import copy
import csv
import io
import os
import sys
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any
from dotenv import load_dotenv

# Load .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


from fastapi import Body, Depends, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.grader import grader
from server.models import Action, EventRecord, Observation, ResetRequest, ResetResult, StateResult, StepResult
from server.tasks.easy import EASY_TASKS
from server.tasks.hard import HARD_TASKS
from server.tasks.medium import MEDIUM_TASKS
from server.custom_api import router as custom_api_router


app = FastAPI(title="AI Code Review Environment", version="1.1.0")

# Security Setup
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(api_key: str = Depends(api_key_header)):
    expected = os.getenv("APP_API_KEY", "openenv_secret_key_123")
    if api_key != expected:
        raise HTTPException(status_code=HTTP_403_FORBIDDEN, detail="Invalid or missing API Key")
    return api_key

# 1. ADD CORS MIDDLEWARE (Critical for Hackathon Validation)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. PATHS & STATIC FILES
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard", "dist")

if os.path.exists(DASHBOARD_DIR):
    app.mount("/ui", StaticFiles(directory=DASHBOARD_DIR, html=True), name="ui")
else:
    print(f"Warning: Dashboard directory not found at {DASHBOARD_DIR}")

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/ui/")

app.include_router(custom_api_router)

class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        stale = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                stale.append(connection)
        for c in stale:
            self.disconnect(c)

manager = ConnectionManager()
event_history = deque(maxlen=50)
episode_history = []
leaderboard = []
performance_history = {"easy": [], "medium": [], "hard": []}

state = {
    "comments_so_far": [],
    "episode_steps": [],
    "step_count": 0,
    "total_reward": 0.0,
    "episode_done": False,
    "prev_score": 0.01,
    "reset_called": False,
    "current_diff": "",
    "ground_truth": [],
    "task_name": "",
    "task_type": "none",
    "max_steps": 10,
    "filename": "snippet.py",
    "episode_id": "",
    "episode_recorded": False,
    "hints_used": 0,
    "max_hints": 3,
    "last_reward": 0.0,
    "latest_event": None,
    "success": False,
    "started_at": None,
    "finished_at": None,
    "model_name": "gemini-1.5-flash",
    "episode_done": False
}

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def parse_task_type(name: str) -> str:
    if name.startswith("easy"): return "easy"
    if name.startswith("medium"): return "medium"
    if name.startswith("hard"): return "hard"
    return "none"

def select_task(name: str) -> tuple[dict, str]:
    if name == "lab_audit":
        # For custom lab, we use whatever is currently in the state (diff)
        return {"diff": state.get("current_diff", ""), "id": "lab_audit", "filename": "lab_snippet.py"}, "medium"
    
    t_type = parse_task_type(name)
    pool = EASY_TASKS if t_type == "easy" else MEDIUM_TASKS if t_type == "medium" else HARD_TASKS
    selected = next((t for t in pool if t.get("id") == name), pool[0])
    return selected, t_type

def reset_runtime_state():
    state["comments_so_far"] = []
    state["episode_steps"] = []
    state["step_count"] = 0
    state["total_reward"] = 0.0
    state["episode_done"] = False
    state["prev_score"] = 0.01
    state["reset_called"] = True
    state["episode_recorded"] = False
    state["hints_used"] = 0
    state["last_reward"] = 0.0
    state["success"] = False
    state["started_at"] = utc_now()
    state["finished_at"] = None

def get_current_obs() -> Observation:
    return Observation(
        diff=state["current_diff"],
        filename=state["filename"],
        step=state["step_count"],
        max_steps=state["max_steps"],
        comments_so_far=state["comments_so_far"],
        current_score=state["prev_score"],
        score_delta=state["last_reward"],
        bugs_remaining_hint=len(state["ground_truth"]) - len(state["comments_so_far"]),
        task_type=state["task_type"],
        episode_id=state["episode_id"],
        task_name=state["task_name"],
        hints_remaining=state["max_hints"] - state["hints_used"],
    )

async def emit_event(t, p):
    event = {"type": t, "timestamp": utc_now(), "payload": p}
    event_history.append(event)
    state["latest_event"] = event
    await manager.broadcast(event)
    return event

@app.get("/health")
async def health():
    import google.generativeai as genai
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    g_active = False
    if gemini_key and "your_" not in gemini_key.lower():
        try:
            genai.configure(api_key=gemini_key)
            # Try a very lightweight call to check if key is valid
            genai.get_model('models/gemini-1.5-flash')
            g_active = True
        except Exception as e:
            print(f"Gemini init warning: {e}")
    o_active = openai_key and len(openai_key) > 20 and "your_" not in openai_key.lower()
    return {"status": "ok", "openai_active": o_active, "gemini_active": g_active, "version": "1.1.0"}

@app.post("/reset", response_model=ResetResult)
async def reset(req: dict | None = Body(default=None), _ = Depends(get_api_key)):
    if req is None: req = {}
    task_name = req.get("task_name") or "easy_001"
    state["model_name"] = req.get("model_name") or "gemini-1.5-flash"
    state["episode_id"] = str(uuid.uuid4())
    selected, t_type = select_task(task_name)
    reset_runtime_state()
    state["task_name"] = task_name
    state["task_type"] = t_type
    state["current_diff"] = selected.get("diff", "")
    state["ground_truth"] = selected.get("ground_truth", [])
    state["filename"] = selected.get("filename", "snippet.py")
    state["max_steps"] = 6 if t_type == "easy" else 8 if t_type == "medium" else 10
    await emit_event("episode_reset", {"episode_id": state["episode_id"], "task_name": task_name, "model_name": state["model_name"]})
    return ResetResult(observation=get_current_obs(), info={"message": "ok"})

def compute_new_score() -> float:
    t = state["task_type"]
    if t == "easy": return grader.score_easy(state["comments_so_far"], state["ground_truth"])
    if t == "medium": return grader.score_medium(state["comments_so_far"], state["ground_truth"])
    return grader.score_hard(state["comments_so_far"], state["ground_truth"])

@app.post("/step", response_model=StepResult)
async def step(payload: dict = Body(...), _ = Depends(get_api_key)):
    if not state["reset_called"] or not state["task_name"]: raise HTTPException(400, "Reset first")
    if state["episode_done"]: raise HTTPException(400, "Done")
    action = Action(**payload)
    state["step_count"] += 1
    step_entry = action.model_dump()
    step_entry["step_number"] = state["step_count"]
    if not action.done: state["comments_so_far"].append(step_entry)
    new_s = compute_new_score()
    reward = grader.compute_reward(state["prev_score"], new_s)
    
    if state["task_name"] == "lab_audit":
        reward = 0.0

    state["total_reward"] += reward
    state["prev_score"] = new_s
    state["last_reward"] = reward
    
    reason = ""
    if action.done or state["step_count"] >= state["max_steps"]:
        state["episode_done"] = True
        
        if state["task_name"] == "lab_audit":
            f_score, judge_reason = grader.grade_custom_lab(state["comments_so_far"], state["current_diff"], os.getenv("GEMINI_API_KEY"))
            state["prev_score"] = f_score
            state["total_reward"] = f_score
            state["last_reward"] = f_score
            reason = f"[AI Judge] {judge_reason}"
            if len(state["comments_so_far"]) > 0:
                state["comments_so_far"][-1]["reason"] = reason
        
        # Record the episode for replay
        if not state["episode_recorded"]:
            if state["task_name"] == "lab_audit":
                is_suc = state["prev_score"] >= 0.70
            else:
                is_suc = grader.is_success(state["task_type"], state["comments_so_far"], state["ground_truth"], state["prev_score"])
            
            history_entry = {
                "episode_id": state["episode_id"],
                "task_name": state["task_name"],
                "task_type": state["task_type"],
                "final_score": state["prev_score"],
                "success": is_suc,
                "steps": copy.deepcopy(state["comments_so_far"]),
                "finished_at": utc_now(),
                "model_name": state["model_name"]
            }
            episode_history.append(history_entry)
            state["episode_recorded"] = True
            await emit_event("episode_finished", history_entry)

    if not reason and state["task_name"] != "lab_audit":
        truth_match = any(grader.comment_matches_ground_truth(step_entry, t, state["task_type"]) for t in state["ground_truth"])
        reason = grader.get_explanation(reward, truth_match, True, True)
    elif not reason:
        reason = "Custom Lab Reviewing..."

    step_entry["reason"] = reason
    if not action.done and state["comments_so_far"]: 
        state["comments_so_far"][-1]["reason"] = reason
        
    obs = get_current_obs()
    await emit_event("step_scored", {"step": state["step_count"], "reward": reward, "done": state["episode_done"], "reason": reason})
    return StepResult(observation=obs, reward=reward, done=state["episode_done"], info={"reason": reason})


@app.get("/hint")
async def get_hint(_ = Depends(get_api_key)):
    if not state["reset_called"] or state["episode_done"]:
        raise HTTPException(400, "No active episode")
    
    if state["hints_used"] >= state["max_hints"]:
        return {"error": "Maximum hints used", "hint": None}

    # Find a bug that hasn't been found yet
    found_lines = [int(c.get("line", 0)) for c in state["comments_so_far"]]
    remaining_bugs = [b for b in state["ground_truth"] if int(b.get("line", 0)) not in found_lines]
    
    if not remaining_bugs:
        return {"error": "No remaining bugs to hint", "hint": None}
    
    target_bug = remaining_bugs[0]
    line = int(target_bug.get("line", 0))
    window = f"Lines {max(1, line-1)} to {line+1}"
    
    state["hints_used"] += 1
    penalty = -0.05
    state["total_reward"] += penalty
    state["last_reward"] = penalty
    
    msg = f"Clue: Look closely at {window}"
    await emit_event("hint_issued", {"hint": msg, "penalty": penalty})
    return {"hint": msg, "penalty": penalty}

@app.websocket("/ws/events")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/state", response_model=StateResult)
async def get_state():
    return StateResult(
        observation=get_current_obs(),
        step=state.get("step_count", 0),
        done=state.get("episode_done", False),
        total_reward=state.get("total_reward", 0.0),
        performance_trend="stable",
        success=state.get("success", False),
        episode_id=state.get("episode_id", ""),
        task_name=state.get("task_name", ""),
        latest_event=EventRecord(**state["latest_event"]) if state.get("latest_event") else None,
        started_at=state.get("started_at"),
        finished_at=state.get("finished_at"),
    )

@app.post("/api/custom/review")
async def review_custom_code(payload: dict = Body(...), _ = Depends(get_api_key)):
    code = payload.get("code", "")
    model = payload.get("model_name", "gemini-1.5-flash")
    if not code: raise HTTPException(400, "Code is required")

    state["episode_id"] = str(uuid.uuid4())
    state["model_name"] = model
    reset_runtime_state()
    state["task_name"] = "lab_audit"
    state["task_type"] = "medium"
    state["current_diff"] = code
    state["ground_truth"] = [] # No ground truth for custom code
    state["filename"] = "lab_snippet.py"
    state["max_steps"] = 5
    
    await emit_event("episode_reset", {"episode_id": state["episode_id"], "task_name": "Lab Audit", "model_name": model})
    
    import threading
    from server.agent import CodeReviewAgent
    agent = CodeReviewAgent(model_name=model)
    # Correctly pass "lab_audit" as task_name argument
    threading.Thread(target=agent.run_review, args=("lab_audit",), daemon=True).start()
    
    return {"status": "started", "episode_id": state["episode_id"]}

@app.get("/events/recent")
async def get_events(): return list(reversed(event_history))

@app.get("/leaderboard")
async def get_lb(): return leaderboard[:10]

@app.post("/leaderboard/submit")
async def submit_to_leaderboard(payload: dict = Body(...), _ = Depends(get_api_key)):
    name = payload.get("agent_name", "Unknown Agent")
    task = payload.get("task", "unknown")
    score = float(payload.get("score", 0.0))
    steps = int(payload.get("steps", 0))
    model = payload.get("model", "unknown")
    
    entry = {
        "submission_id": str(uuid.uuid4())[:8],
        "agent_name": name,
        "task": task,
        "score": score,
        "steps": steps,
        "model": model,
        "timestamp": utc_now()
    }
    leaderboard.append(entry)
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    await emit_event("leaderboard_updated", {"rank": leaderboard.index(entry) + 1, "total": len(leaderboard)})
    return {"status": "ok", "entry": entry}

@app.get("/replay/{eid}")
async def get_replay(eid: str): 
    return next((e for e in episode_history if e["episode_id"] == eid), None)

@app.get("/export/json")
async def export_json_episodes():
    return episode_history

@app.get("/export/csv")
async def export_csv_episodes():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["episode_id", "task_name", "task_type", "final_score", "model_name", "finished_at"])
    for ep in episode_history:
        writer.writerow([ep["episode_id"], ep["task_name"], ep["task_type"], ep["final_score"], ep.get("model_name", ""), ep.get("finished_at", "")])
    return Response(content=output.getvalue(), media_type="text/csv")

@app.on_event("startup")
async def startup_event():
    print("\n" + "="*50)
    print("  OPENENV AI CODE REVIEW SYSTEM")
    print("  STATUS: ONLINE")
    print(f"  DASHBOARD : http://127.0.0.1:7860/ui/")
    print(f"  API HEALTH: http://127.0.0.1:7860/health")
    print("="*50 + "\n")

# ============ BATTLE MODE ============
# New in-memory battle storage
battles: dict = {}

@app.post("/battle/create")
async def create_battle(
    task: str = "easy",
    models: list[str] = [
        "gpt-4o",
        "gemini-1.5-flash", 
        "Qwen/Qwen2.5-72B-Instruct"
    ]
):
    battle_id = str(uuid.uuid4())
    battles[battle_id] = {
        "battle_id": battle_id,
        "task": task,
        "models": models,
        "scores": {m: 0.0 for m in models},
        "steps": {m: 0 for m in models},
        "done": {m: False for m in models},
        "winner": None,
        "status": "running",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "comments": {m: [] for m in models}
    }
    return battles[battle_id]

@app.post("/battle/{battle_id}/step/{model_name}")
async def battle_step(
    battle_id: str,
    model_name: str,
    action: Action
):
    if battle_id not in battles:
        raise HTTPException(404, "Battle not found")
    battle = battles[battle_id]
    if model_name not in battle["models"]:
        raise HTTPException(400, "Model not in battle")
    
    old_score = battle["scores"][model_name]
    battle["steps"][model_name] += 1
    battle["comments"][model_name].append({
        "line": action.line,
        "severity": action.severity,
        "message": action.message,
        "step": battle["steps"][model_name]
    })
    
    new_score = min(old_score + 0.15, 1.0)
    battle["scores"][model_name] = new_score
    
    if action.done or battle["steps"][model_name] >= 6:
        battle["done"][model_name] = True
    
    if all(battle["done"].values()):
        battle["status"] = "completed"
        # Only set winner if battle is completed.
        battle["winner"] = max(
            battle["scores"],
            key=battle["scores"].get
        )
    
    return {
        "model": model_name,
        "reward": new_score - old_score,
        "score": new_score,
        "scores": battle["scores"],
        "winner": battle["winner"]
    }

@app.get("/battle/{battle_id}/status")
async def battle_status(battle_id: str):
    if battle_id not in battles:
        raise HTTPException(404, "Battle not found")
    return battles[battle_id]

@app.get("/battle/{battle_id}/result")
async def battle_result(battle_id: str):
    if battle_id not in battles:
        raise HTTPException(404, "Battle not found")
    battle = battles[battle_id]
    return {
        "battle_id": battle_id,
        "winner": battle["winner"],
        "final_scores": battle["scores"],
        "steps": battle["steps"],
        "status": battle["status"]
    }

@app.websocket("/battle/{battle_id}/ws")
async def battle_websocket(
    websocket: WebSocket,
    battle_id: str
):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
            if battle_id in battles:
                await websocket.send_json(
                    battles[battle_id]
                )
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 to allow external traffic in Docker environment
    uvicorn.run(app, host="0.0.0.0", port=7860, log_level="info")
