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


from fastapi import Body, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.grader import grader
from server.models import Action, EventRecord, Observation, ResetResult, StateResult, StepResult
from server.tasks.easy import EASY_TASKS
from server.tasks.hard import HARD_TASKS
from server.tasks.medium import MEDIUM_TASKS
from server.custom_api import router as custom_api_router


app = FastAPI(title="AI Code Review Environment", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect the custom API router
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
        stale_connections: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                stale_connections.append(connection)

        for connection in stale_connections:
            self.disconnect(connection)


manager = ConnectionManager()
event_history: deque[dict[str, Any]] = deque(maxlen=50)
episode_history: list[dict[str, Any]] = []
leaderboard: list[dict[str, Any]] = []
performance_history: dict[str, list[float]] = {"easy": [], "medium": [], "hard": []}

state: dict[str, Any] = {
    "comments_so_far": [],
    "episode_steps": [],
    "step_count": 0,
    "total_reward": 0.0,
    "episode_done": False,
    "prev_score": 0.0,
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
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_task_type(task_name: str) -> str:
    if task_name.startswith("easy"):
        return "easy"
    if task_name.startswith("medium"):
        return "medium"
    if task_name.startswith("hard"):
        return "hard"
    return "none"


def get_task_pool(task_type: str) -> list[dict[str, Any]]:
    if task_type == "easy":
        return EASY_TASKS
    if task_type == "medium":
        return MEDIUM_TASKS
    return HARD_TASKS


def select_task(task_name: str) -> tuple[dict[str, Any], str]:
    task_type = parse_task_type(task_name)
    pool = get_task_pool(task_type)
    selected = next((task for task in pool if task.get("id") == task_name), pool[0])
    return selected, task_type


def reset_runtime_state() -> None:
    state["comments_so_far"] = []
    state["episode_steps"] = []
    state["step_count"] = 0
    state["total_reward"] = 0.0
    state["episode_done"] = False
    state["prev_score"] = 0.0
    state["reset_called"] = True
    state["episode_recorded"] = False
    state["hints_used"] = 0
    state["max_hints"] = 3
    state["last_reward"] = 0.0
    state["latest_event"] = None
    state["success"] = False
    state["started_at"] = utc_now()
    state["finished_at"] = None


def get_performance_trend(task_type: str) -> str:
    recent_scores = performance_history.get(task_type, [])
    if len(recent_scores) < 3:
        return "stable"

    last_three = recent_scores[-3:]
    if last_three[0] < last_three[1] < last_three[2]:
        return "improving"
    if last_three[0] > last_three[1] > last_three[2]:
        return "declining"
    return "stable"


def count_unresolved_bugs() -> int:
    task_type = state.get("task_type", "none")
    comments = state.get("comments_so_far", [])
    ground_truth = state.get("ground_truth", [])

    unresolved = 0
    for truth in ground_truth:
        if not any(
            grader.comment_matches_ground_truth(comment, truth, task_type)
            for comment in comments
        ):
            unresolved += 1
    return unresolved


def get_first_unresolved_bug() -> dict[str, Any] | None:
    task_type = state.get("task_type", "none")
    for truth in state.get("ground_truth", []):
        if not any(
            grader.comment_matches_ground_truth(comment, truth, task_type)
            for comment in state.get("comments_so_far", [])
        ):
            return truth
    return None


def get_current_obs() -> Observation:
    return Observation(
        diff=state.get("current_diff", ""),
        filename=state.get("filename", "snippet.py"),
        step=state.get("step_count", 0),
        max_steps=state.get("max_steps", 10),
        comments_so_far=state.get("comments_so_far", []),
        current_score=state.get("prev_score", 0.0),
        score_delta=state.get("last_reward", 0.0),
        bugs_remaining_hint=count_unresolved_bugs(),
        task_type=state.get("task_type", "none"),
        episode_id=state.get("episode_id", ""),
        task_name=state.get("task_name", ""),
        hints_remaining=max(0, state.get("max_hints", 3) - state.get("hints_used", 0)),
    )


def build_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    event = {
        "type": event_type,
        "timestamp": utc_now(),
        "payload": payload,
    }
    event_history.append(event)
    state["latest_event"] = event
    return event


def build_state_payload() -> dict[str, Any]:
    return StateResult(
        observation=get_current_obs(),
        step=state.get("step_count", 0),
        done=state.get("episode_done", False),
        total_reward=state.get("total_reward", 0.0),
        performance_trend=get_performance_trend(state.get("task_type", "none")),
        success=state.get("success", False),
        episode_id=state.get("episode_id", ""),
        task_name=state.get("task_name", ""),
        latest_event=EventRecord(**state["latest_event"]) if state.get("latest_event") else None,
        started_at=state.get("started_at"),
        finished_at=state.get("finished_at"),
    ).model_dump()


def build_episode_summary() -> dict[str, Any]:
    return {
        "episode_id": state["episode_id"],
        "task": state["task_type"],
        "task_name": state["task_name"],
        "filename": state["filename"],
        "steps": copy.deepcopy(state["episode_steps"]),
        "final_score": float(state["prev_score"]),
        "total_reward": float(state["total_reward"]),
        "success": bool(state["success"]),
        "hints_used": int(state["hints_used"]),
        "max_steps": int(state["max_steps"]),
        "started_at": state["started_at"],
        "finished_at": state["finished_at"] or utc_now(),
        "timestamp": utc_now(),
    }


def finalize_episode() -> dict[str, Any] | None:
    if not state.get("episode_done") or state.get("episode_recorded") or not state.get("task_name"):
        return None

    state["finished_at"] = state.get("finished_at") or utc_now()
    summary = build_episode_summary()
    episode_history.append(summary)

    if len(episode_history) > 50:
        del episode_history[:-50]

    task_type = state.get("task_type")
    if task_type in performance_history:
        performance_history[task_type].append(float(state.get("prev_score", 0.0)))
        if len(performance_history[task_type]) > 5:
            del performance_history[task_type][:-5]

    state["episode_recorded"] = True
    return summary


async def emit_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    event = build_event(event_type, payload)
    await manager.broadcast(event)
    return event


def compute_new_score() -> float:
    if state["task_type"] == "easy":
        return grader.score_easy(state["comments_so_far"], state["ground_truth"])
    if state["task_type"] == "medium":
        return grader.score_medium(state["comments_so_far"], state["ground_truth"])
    return grader.score_hard(state["comments_so_far"], state["ground_truth"])


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "version": "1.1.0",
        "event_stream": "/ws/events",
        "active_episode_id": state.get("episode_id", ""),
    }


@app.post("/reset", response_model=ResetResult)
async def reset(task: dict[str, Any] | None = Body(default=None)) -> ResetResult:
    reset_runtime_state()
    state["episode_id"] = str(uuid.uuid4())

    if not task or "task_name" not in task:
        state["current_diff"] = ""
        state["ground_truth"] = []
        state["task_name"] = ""
        state["task_type"] = "none"
        state["max_steps"] = 10
        state["filename"] = "snippet.py"

        await emit_event(
            "episode_reset",
            {
                "episode_id": state["episode_id"],
                "task": state["task_type"],
                "task_name": state["task_name"],
                "filename": state["filename"],
                "max_steps": state["max_steps"],
            },
        )
        return ResetResult(
            observation=get_current_obs(),
            info={
                "message": "empty reset",
                "episode_id": state["episode_id"],
                "task": state["task_type"],
                "task_name": state["task_name"],
            },
        )

    selected, task_type = select_task(str(task["task_name"]))
    state["current_diff"] = selected.get("diff", "")
    state["ground_truth"] = selected.get("ground_truth", [])
    state["task_name"] = selected.get("id", str(task["task_name"]))
    state["task_type"] = task_type
    state["filename"] = selected.get("filename", "snippet.py")

    if task_type == "easy":
        state["max_steps"] = 6
    elif task_type == "medium":
        state["max_steps"] = 8
    else:
        state["max_steps"] = 10

    await emit_event(
        "episode_reset",
        {
            "episode_id": state["episode_id"],
            "task": state["task_type"],
            "task_name": state["task_name"],
            "filename": state["filename"],
            "max_steps": state["max_steps"],
        },
    )

    return ResetResult(
        observation=get_current_obs(),
        info={
            "message": "ok",
            "episode_id": state["episode_id"],
            "task": state["task_type"],
            "task_name": state["task_name"],
        },
    )


@app.post("/step", response_model=StepResult)
async def step(action_payload: dict[str, Any]) -> StepResult:
    if not state["reset_called"] or not state["task_name"]:
        raise HTTPException(status_code=400, detail="Step called before reset")
    if state["episode_done"]:
        raise HTTPException(status_code=400, detail="Episode already done")

    try:
        action = Action(**action_payload)
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    state["step_count"] += 1
    step_entry = action.model_dump()
    step_entry["step_number"] = state["step_count"]
    step_entry["score_delta"] = 0.0

    if not action.done:
        state["comments_so_far"].append(dict(step_entry))

    new_score = compute_new_score()
    reward = grader.compute_reward(state["prev_score"], new_score)

    review_success = grader.is_success(
        state["task_type"],
        state["comments_so_far"],
        state["ground_truth"],
        new_score,
    )
    state["total_reward"] += reward
    state["prev_score"] = new_score
    state["last_reward"] = reward

    if action.done or state["step_count"] >= state["max_steps"]:
        state["episode_done"] = True

    state["success"] = review_success if state["episode_done"] else False

    step_entry["score_delta"] = reward
    state["episode_steps"].append(step_entry)

    # Get grading explanation
    truth_match = any(grader.comment_matches_ground_truth(dict(step_entry), t, state["task_type"]) for t in state["ground_truth"])
    explanation = grader.get_explanation(reward, truth_match, True, True)

    step_entry["reason"] = explanation
    if not action.done and state["comments_so_far"]:
        state["comments_so_far"][-1]["score_delta"] = reward
        state["comments_so_far"][-1]["reason"] = explanation

    observation = get_current_obs()

    step_event = {
        "episode_id": state["episode_id"],
        "task": state["task_type"],
        "task_name": state["task_name"],
        "step": state["step_count"],
        "reward": reward,
        "current_score": new_score,
        "done": state["episode_done"],
        "success": state["success"],
        "action": step_entry,
        "reason": explanation,
    }
    await emit_event("step_scored", step_event)

    if state["episode_done"]:
        summary = finalize_episode()
        if summary is not None:
            await emit_event("episode_finished", summary)

    return StepResult(
        observation=observation,
        reward=reward,
        done=state["episode_done"],
        info={
            "message": "ok",
            "episode_id": state["episode_id"],
            "success": state["success"],
            "reason": explanation,
        },
    )


@app.get("/state", response_model=StateResult)
async def get_state() -> StateResult:
    return JSONResponse(content=build_state_payload())


@app.get("/events/recent")
async def get_recent_events() -> list[dict[str, Any]]:
    return list(reversed(event_history))


@app.get("/replay/{episode_id}", response_model=None)
async def get_replay(episode_id: str) -> Any:
    episode = next((item for item in episode_history if item.get("episode_id") == episode_id), None)
    if episode is None:
        return JSONResponse(status_code=404, content={"error": "Episode not found"})
    return episode


@app.post("/leaderboard/submit", response_model=None)
async def submit_leaderboard(entry: dict[str, Any] = Body(...)) -> Any:
    try:
        score = float(entry.get("score"))
    except (TypeError, ValueError):
        return JSONResponse(status_code=400, content={"error": "Score must be between 0.0 and 1.0"})

    try:
        steps = int(entry.get("steps", 0))
    except (TypeError, ValueError):
        steps = 0

    if score < 0.0 or score > 1.0:
        return JSONResponse(status_code=400, content={"error": "Score must be between 0.0 and 1.0"})

    raw_task = str(entry.get("task", "unknown"))
    leaderboard_entry = {
        "submission_id": str(uuid.uuid4()),
        "agent_name": str(entry.get("agent_name", "unknown")),
        "task": raw_task,
        "task_type": parse_task_type(raw_task),
        "score": score,
        "steps": steps,
        "model": str(entry.get("model", "unknown")),
        "timestamp": utc_now(),
    }
    leaderboard.append(leaderboard_entry)
    leaderboard.sort(key=lambda item: (-item.get("score", 0.0), item.get("steps", 999999)))
    rank = next(
        (
            index + 1
            for index, item in enumerate(leaderboard)
            if item.get("submission_id") == leaderboard_entry["submission_id"]
        ),
        len(leaderboard),
    )
    if len(leaderboard) > 100:
        del leaderboard[100:]

    await emit_event(
        "leaderboard_updated",
        {
            "rank": rank,
            "episode_id": state.get("episode_id", ""),
            "agent_name": leaderboard_entry["agent_name"],
            "task": leaderboard_entry["task"],
            "score": leaderboard_entry["score"],
        },
    )
    return {"rank": rank, "total_entries": len(leaderboard)}


@app.get("/leaderboard")
async def get_leaderboard() -> list[dict[str, Any]]:
    return [
        {
            "rank": index + 1,
            "agent_name": item.get("agent_name"),
            "task": item.get("task"),
            "task_type": item.get("task_type"),
            "score": item.get("score"),
            "steps": item.get("steps"),
            "model": item.get("model"),
            "timestamp": item.get("timestamp"),
        }
        for index, item in enumerate(leaderboard[:10])
    ]


@app.get("/hint")
async def get_hint() -> dict[str, Any]:
    if not state.get("reset_called") or not state.get("task_name") or state.get("episode_done"):
        return JSONResponse(status_code=400, content={"error": "No active episode"})

    if state["hints_used"] >= state["max_hints"]:
        return {"error": "No hints remaining", "hints_remaining": 0}

    unresolved_bug = get_first_unresolved_bug()
    if unresolved_bug is None:
        return {
            "error": "No unseen bugs remaining",
            "hints_remaining": state["max_hints"] - state["hints_used"],
        }

    line_number = max(1, int(unresolved_bug.get("line", 1)))
    start_line = max(1, line_number - 1)
    end_line = max(start_line, line_number + 1)
    penalty = -0.05

    state["hints_used"] += 1
    state["total_reward"] += penalty
    state["last_reward"] = penalty

    payload = {
        "episode_id": state["episode_id"],
        "task_name": state["task_name"],
        "hint": f"There is a bug between lines {start_line} and {end_line}",
        "hints_remaining": state["max_hints"] - state["hints_used"],
        "penalty": penalty,
    }
    await emit_event("hint_issued", payload)
    return payload


@app.get("/export/json")
async def export_json() -> list[dict[str, Any]]:
    return copy.deepcopy(episode_history)


@app.get("/export/csv")
async def export_csv() -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "episode_id",
            "task",
            "task_name",
            "filename",
            "final_score",
            "total_reward",
            "success",
            "steps",
            "started_at",
            "finished_at",
        ]
    )
    for episode in episode_history:
        writer.writerow(
            [
                episode.get("episode_id", ""),
                episode.get("task", ""),
                episode.get("task_name", ""),
                episode.get("filename", ""),
                episode.get("final_score", 0.0),
                episode.get("total_reward", 0.0),
                episode.get("success", False),
                len(episode.get("steps", [])),
                episode.get("started_at", ""),
                episode.get("finished_at", ""),
            ]
        )
    return Response(content=buffer.getvalue(), media_type="text/csv")


@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "type": "connection_ready",
                "timestamp": utc_now(),
                "payload": {"message": "Live event stream connected"},
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/")
async def root():
    # Redirect backend port root to the frontend port (5173) for a seamless experience
    return RedirectResponse(url="http://127.0.0.1:5173")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_portal():
    return HTMLResponse(content="""
    <html>
        <head>
            <title>AI Code Review Portal</title>
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Outfit', sans-serif; background: #fbfcfd; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #0f172a; }
                .card { padding: 56px; border-radius: 32px; border: 1px solid rgba(15,23,42,0.06); background: white; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.05); text-align: center; max-width: 460px; }
                h2 { font-size: 2rem; margin: 0 0 16px; font-weight: 700; }
                p { color: #64748b; line-height: 1.6; margin: 0 0 40px; font-size: 1.1rem; }
                .btn { display: inline-block; background: #3b82f6; color: white; padding: 16px 32px; border-radius: 16px; text-decoration: none; font-weight: 600; font-size: 1.05rem; transition: all 0.25s ease; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); }
                .btn:hover { background: #2563eb; transform: translateY(-3px); box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4); }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>AI Code Review Portal</h2>
                <p>The evaluation engine is online and ready. The interactive dashboard is active at port 5173.</p>
                <a href="http://127.0.0.1:5173" class="btn">Launch Dashboard</a>
            </div>
        </body>
    </html>
    """)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host="0.0.0.0", port=7860, reload=False)
