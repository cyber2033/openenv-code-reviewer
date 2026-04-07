import json
import os
from typing import Optional

import httpx
from openai import OpenAI

API_BASE_URL = os.getenv("API_BASE_URL", "https://router.huggingface.co/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-72B-Instruct")
HF_TOKEN = os.getenv("HF_TOKEN") or os.getenv("API_KEY")
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:7860")
BENCHMARK = os.getenv("BENCHMARK", "code-review")

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
        reset_res = httpx.post(f"{SERVER_URL}/reset", json={"task_name": task_name}, timeout=60.0)
        reset_res.raise_for_status()
        reset_data = reset_res.json()
    except httpx.HTTPError:
        print(f"[END] success=false steps=0 score=0.000 rewards=", flush=True)
        return

    if "observation" not in reset_data:
        print(f"[END] success=false steps=0 score=0.000 rewards=", flush=True)
        return

    obs = reset_data["observation"]
    max_steps = int(obs.get("max_steps", 10))
    rewards: list[float] = []
    done = False
    step = 0

    while not done and step < max_steps:
        step += 1
        diff_text = obs.get("diff", "")
        try:
            response = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Diff:\n{diff_text}"},
                ],
                temperature=0.2,
                max_tokens=400,
            )
            raw = response.choices[0].message.content or ""
        except Exception as e:
            log_step(step, "api_error", 0.0, False, str(e))
            continue

        try:
            raw = raw.replace("```json", "").replace("```", "").strip()
            action = json.loads(raw)
        except json.JSONDecodeError as e:
            log_step(step, "parse_error", 0.0, False, str(e))
            continue

        try:
            step_res = httpx.post(f"{SERVER_URL}/step", json=action, timeout=60.0)
        except httpx.RequestError as e:
            log_step(step, json.dumps(action, ensure_ascii=False), 0.0, False, str(e))
            continue

        if step_res.status_code != 200:
            log_step(step, json.dumps(action, ensure_ascii=False), 0.0, False, step_res.text)
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
        state_data = {"observation": {"current_score": 0.0}, "step": step}

    final_score = float(state_data["observation"]["current_score"])
    steps_total = int(state_data.get("step", step))
    success = bool(state_data.get("success", final_score >= 0.5))
    r_str = ",".join(f"{r:.2f}" for r in rewards)
    print(
        f"[END] success={'true' if success else 'false'} steps={steps_total} score={final_score:.3f} rewards={r_str}",
        flush=True,
    )
    try:
        leaderboard_res = httpx.post(
            f"{SERVER_URL}/leaderboard/submit",
            json={
                "agent_name": MODEL_NAME,
                "task": task_name,
                "score": final_score,
                "steps": steps_total,
                "model": MODEL_NAME,
            },
            timeout=30.0,
        )
        if leaderboard_res.status_code == 200:
            leaderboard_res.json()
    except Exception:
        pass


if __name__ == "__main__":
    run_task("easy_001")
    run_task("medium_001")
    run_task("hard_001")
