import json
import os
import sys
from typing import Optional

import httpx
from openai import OpenAI

# 7. Make sure SERVER_URL has no trailing slash
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:7860").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-72B-Instruct")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("API_KEY")
BENCHMARK = os.getenv("BENCHMARK", "code-review")

# 1. Add health check at very start
try:
    with httpx.Client(timeout=10.0) as client_hc:
        r = client_hc.get(f"{SERVER_URL}/health")
        if r.status_code != 200:
            print(f"[ERROR] Server not running (Status: {r.status_code})")
            sys.exit(1)
        print("[DEBUG] Server OK:", r.json())
except Exception as e:
    print(f"[ERROR] Could not connect to server at {SERVER_URL}: {e}")
    sys.exit(1)

SYSTEM_PROMPT = (
    "You are an expert code reviewer. Read the code diff carefully.\n"
    "Think step by step about what bugs exist.\n"
    "Then output ONLY one raw JSON object with these exact fields:\n"
    "{line: int, severity: critical|high|medium|low, category: security|logic|null_check|type_error|performance|style, message: str, fix: str, done: bool}\n"
    "Set done: true when you have found all bugs.\n"
    "No markdown, no explanation, just raw JSON."
)

client = OpenAI(base_url=API_BASE_URL, api_key=HF_TOKEN or "")


def log_step(step: int, action_repr: str, reward: float, done: bool, error: Optional[str]) -> None:
    err = "null" if error is None else json.dumps(str(error))
    print(
        f"[STEP] step={step} action={action_repr} reward={reward:.2f} done={'true' if done else 'false'} error={err}",
        flush=True,
    )


def run_task(task_name: str) -> None:
    print(f"[START] task={task_name} env={BENCHMARK} model={MODEL_NAME}", flush=True)

    try:
        # 2. Add debug after reset call
        response = httpx.post(f"{SERVER_URL}/reset", json={"task_name": task_name}, timeout=60.0)
        print("[DEBUG] Reset status:", response.status_code)
        print("[DEBUG] Reset body:", response.text[:300])
        response.raise_for_status()
        reset_data = response.json()
    except Exception as e:
        print(f"[DEBUG] Reset failed: {e}")
        print(f"[END] success=false steps=0 score=0.01 rewards=", flush=True)
        return

    if "observation" not in reset_data:
        print("[DEBUG] 'observation' missing in reset_data")
        print(f"[END] success=false steps=0 score=0.01 rewards=", flush=True)
        return

    obs = reset_data["observation"]
    max_steps = int(obs.get("max_steps", 10))
    rewards: list[float] = []
    done = False
    step = 0

    while not done and step < max_steps:
        step += 1
        diff = obs.get("diff", "")
        
        # 3. Add debug before LLM call
        print("[DEBUG] Calling LLM with diff length:", len(diff))
        
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Diff:\n{diff}"},
                ],
                temperature=0.2,
                max_tokens=400,
            )
            raw = response.choices[0].message.content or ""
            # 4. Add debug after LLM response
            print("[DEBUG] LLM raw response:", raw[:200])
        except Exception as e:
            print(f"[DEBUG] LLM call error: {e}")
            log_step(step, "api_error", 0.01, False, str(e))
            continue

        # 5. Wrap JSON parse in try/except
        try:
            raw_clean = raw.replace("```json", "")
            raw_clean = raw_clean.replace("```", "").strip()
            action = json.loads(raw_clean)
        except Exception as e:
            print(f"[DEBUG] Parse error: {e}")
            log_step(step, "parse_error", 0.01, False, str(e))
            continue

        try:
            step_res = httpx.post(f"{SERVER_URL}/step", json=action, timeout=60.0)
            # 8. Print every API response status
            print("[DEBUG] Step response:", step_res.status_code)
            print("[DEBUG] Step body:", step_res.text[:200])
        except httpx.RequestError as e:
            log_step(step, json.dumps(action, ensure_ascii=False), 0.01, False, str(e))
            continue

        if step_res.status_code != 200:
            log_step(step, json.dumps(action, ensure_ascii=False), 0.01, False, step_res.text)
            continue

        data = step_res.json()
        obs = data["observation"]
        rew = float(data["reward"])
        done = bool(data["done"])
        rewards.append(rew)

        action_str = json.dumps(action, ensure_ascii=False)
        log_step(step, action_str, rew, done, None)

    try:
        state_res = httpx.get(f"{SERVER_URL}/state", timeout=30.0)
        state_res.raise_for_status()
        state_data = state_res.json()
    except httpx.HTTPError:
        state_data = {"observation": {"current_score": 0.01}, "step": step}

    final_score = float(state_data["observation"].get("current_score", 0.01))
    steps_total = int(state_data.get("step", step))
    success = bool(state_data.get("success", final_score >= 0.5))
    r_str = ",".join(f"{r:.2f}" for r in rewards)
    print(
        f"[END] success={'true' if success else 'false'} steps={steps_total} score={final_score:.3f} rewards={r_str}",
        flush=True,
    )
    
    # Leaderboard submission (optional, but keep for completeness)
    try:
        httpx.post(
            f"{SERVER_URL}/leaderboard/submit",
            json={
                "agent_name": MODEL_NAME,
                "task": task_name,
                "score": final_score,
                "steps": steps_total,
                "model": MODEL_NAME,
            },
            timeout=10.0,
        )
    except Exception:
        pass


if __name__ == "__main__":
    # 6. Make sure task names match exactly
    run_task("easy")
    run_task("medium")
    run_task("hard")
