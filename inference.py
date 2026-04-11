"""
Module: inference.py
Purpose: Standalone inference runner for the OpenEnv AI Code Review Environment.
         Connects to the running backend, iterates through tasks, and prints
         structured [START] / [STEP] / [END] lines required by the evaluator.

FIX APPLIED:
  - Added automatic Gemini fallback when OpenAI key is missing or invalid.
    This resolves the zero-score / steps=0 issue caused by silent LLM auth failure.
  - Provider is auto-detected: if GEMINI_API_KEY is set, use Gemini natively.
  - OpenAI path still works when OPENAI_API_KEY or HF_TOKEN is present.

Project: OpenEnv AI Code Review Environment
"""

# Standard library
import json
import logging
import os
import re
import sys

# Third party
import httpx
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Logging setup — use stderr so it doesn't contaminate evaluator stdout
# ---------------------------------------------------------------------------
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------
API_BASE_URL: str = os.getenv("API_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-1.5-flash")
HF_TOKEN: str | None = os.getenv("HF_TOKEN")
GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", "").strip() or None
OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", "").strip() or None
APP_API_KEY: str = os.getenv("APP_API_KEY", "openenv_secret_key_123")
SERVER_URL: str = os.getenv("SERVER_URL", "http://127.0.0.1:7860")
BENCHMARK_NAME: str = os.getenv("BENCHMARK", "code-review")

# Authenticate against the backend using the shared API key
HEADERS: dict[str, str] = {"X-API-Key": APP_API_KEY}

# ---------------------------------------------------------------------------
# Auto-detect which LLM provider is available
# 
# Priority:
#   1. GEMINI_API_KEY → use Gemini (google-generativeai SDK directly)
#   2. HF_TOKEN / OPENAI_API_KEY → use OpenAI-compatible client
# ---------------------------------------------------------------------------
_openai_key_valid = (OPENAI_API_KEY and "your_" not in OPENAI_API_KEY) or HF_TOKEN
_gemini_key_valid = GEMINI_API_KEY and "your_" not in GEMINI_API_KEY

if _gemini_key_valid and ("gemini" in MODEL_NAME.lower() or not _openai_key_valid):
    PROVIDER = "gemini"
    logger.info("LLM Provider: Gemini (%s)", MODEL_NAME)
elif _openai_key_valid:
    PROVIDER = "openai"
    logger.info("LLM Provider: OpenAI-compatible (%s)", MODEL_NAME)
else:
    # No valid key found — log clearly so user knows why steps=0
    PROVIDER = "none"
    logger.error(
        "CRITICAL: No valid LLM key found. "
        "Set GEMINI_API_KEY or OPENAI_API_KEY in your .env file. "
        "All tasks will return steps=0 score=0.01."
    )

# ---------------------------------------------------------------------------
# Initialize provider-specific client
# ---------------------------------------------------------------------------
if PROVIDER == "openai":
    from openai import OpenAI
    client = OpenAI(
        base_url=API_BASE_URL,
        api_key=HF_TOKEN or OPENAI_API_KEY or "no-key",
    )

if PROVIDER == "gemini":
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# System prompt — identical across both providers
# ---------------------------------------------------------------------------
SYSTEM_PROMPT: str = (
    "You are an expert code reviewer. Read the code diff carefully.\n"
    "Identify bugs and output ONLY one raw JSON object with these fields:\n"
    '{"line": int, "severity": "high"|"medium"|"low", "category": "security"|"logic", "message": "str", "fix": "str", "done": bool}'
)


def call_llm(diff_text: str) -> str:
    """Call the configured LLM provider with the code diff and return its response.

    Supports two providers:
      - Gemini: uses google.generativeai SDK directly.
      - OpenAI: uses the OpenAI-compatible client.

    Args:
        diff_text: The code diff to be reviewed.

    Returns:
        str: Raw text response from the LLM (expected to be JSON).

    Raises:
        RuntimeError: If no provider is configured.
        Exception: Any network or API error from the provider.
    """
    if PROVIDER == "gemini":
        # Gemini does not have a separate system message — prepend it to the user message
        model = genai.GenerativeModel("gemini-1.5-flash")
        full_prompt = f"{SYSTEM_PROMPT}\n\nDiff:\n{diff_text}"
        response = model.generate_content(full_prompt)
        return response.text

    if PROVIDER == "openai":
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Diff:\n{diff_text}"},
            ],
            temperature=0.1,
            timeout=20.0,
        )
        return completion.choices[0].message.content or ""

    raise RuntimeError(
        "No LLM provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY."
    )


def parse_llm_response(raw: str) -> dict:
    """Parse and clean a raw LLM response into an action dict.

    Handles cases where the LLM wraps its JSON in markdown code fences.

    Args:
        raw: Raw text response from the LLM.

    Returns:
        dict: Parsed action data with keys: line, severity, category, message, fix, done.

    Raises:
        json.JSONDecodeError: If the cleaned response is not valid JSON.
    """
    cleaned = raw.strip()

    # Strip markdown code fences if present
    if "```json" in cleaned:
        cleaned = cleaned.split("```json")[1].split("```")[0].strip()
    elif "```" in cleaned:
        cleaned = cleaned.split("```")[1].split("```")[0].strip()

    # As a last resort, extract the first JSON object using regex
    if not cleaned.startswith("{"):
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(0)

    return json.loads(cleaned)


def run_task(task_name: str) -> None:
    """Run a complete code review episode for the specified task.

    This function:
      1. Resets the environment via POST /reset.
      2. Iterates up to max_steps, calling the LLM and submitting each
         action to POST /step.
      3. Prints structured [START], [STEP], and [END] lines to stdout
         in the exact format required by the OpenEnv evaluator.

    If no LLM provider is available (PROVIDER == 'none'), the task exits
    immediately with a safe [END] line rather than hanging.

    Args:
        task_name: The task identifier to load (e.g. 'easy_001', 'hard_001').

    Returns:
        None. All evaluator output is written to stdout via print().
    """
    # ------------------------------------------------------------------
    # Guard — if no LLM is configured, exit immediately with minimum score
    # ------------------------------------------------------------------
    if PROVIDER == "none":
        print(f"[END] success=false steps=0 score=0.01 rewards=0.01")
        return

    # ------------------------------------------------------------------
    # Phase 1 — Reset the environment and load the task
    # ------------------------------------------------------------------
    try:
        resp = httpx.post(
            f"{SERVER_URL}/reset",
            json={"task_name": task_name},
            headers=HEADERS,
            timeout=30.0,
        )
        resp.raise_for_status()
        obs = resp.json()["observation"]
        logger.info("Episode reset successful for task: %s", task_name)
    except Exception as e:
        # If reset fails the evaluator still expects a valid [END] line
        logger.error("Failed to reset environment for task '%s': %s", task_name, e)
        print(f"[END] success=false steps=0 score=0.01 rewards=0.01")
        return

    # Evaluator-required [START] line — must be printed to stdout
    print(f"[START] task={task_name} env={BENCHMARK_NAME} model={MODEL_NAME}")

    # ------------------------------------------------------------------
    # Phase 2 — Step loop: LLM reviews the diff, submits one action per step
    # ------------------------------------------------------------------
    done: bool = False
    step_count: int = 0
    rewards_list: list[float] = []
    success: bool = False
    last_error: str = "null"

    while not done and step_count < obs.get("max_steps", 10):
        step_count += 1
        diff_text: str = obs.get("diff", "")

        try:
            # Call whichever LLM provider is configured
            raw_response = call_llm(diff_text)
            action_data = parse_llm_response(raw_response)

            # Compact JSON string for [STEP] log line (no spaces = evaluator-safe)
            action_str = json.dumps(action_data).replace(" ", "")

            # Submit the action to the backend /step endpoint
            step_resp = httpx.post(
                f"{SERVER_URL}/step",
                json=action_data,
                headers=HEADERS,
                timeout=30.0,
            )
            step_resp.raise_for_status()
            step_result = step_resp.json()

            # Extract updated state from the step response
            obs = step_result["observation"]
            done = step_result["done"]
            reward = float(step_result.get("reward", 0.01))
            rewards_list.append(reward)

            # Mark episode as successful if any step earns a meaningful reward
            if reward > 0.2:
                success = True

            # Evaluator-required [STEP] line
            done_str = "true" if done else "false"
            print(
                f"[STEP] step={step_count} action={action_str} "
                f"reward={reward:.2f} done={done_str} error={last_error}"
            )
            logger.info(
                "Step %d complete — reward=%.3f done=%s", step_count, reward, done_str
            )

        except Exception as e:
            last_error = str(e).replace(" ", "_")
            rewards_list.append(0.01)
            logger.error("Step %d failed: %s", step_count, e)
            # Evaluator-required [STEP] failure line
            print(
                f"[STEP] step={step_count} action=failed reward=0.01 done=true error={last_error}"
            )
            break

    # ------------------------------------------------------------------
    # Phase 3 — Emit the final [END] line with episode summary
    # ------------------------------------------------------------------
    success_str = "true" if success else "false"
    rewards_str = ",".join([f"{r:.2f}" for r in rewards_list]) or "0.01"

    # Safely extract the final score from the last observation
    try:
        final_score = float(obs.get("current_score", 0.01))
        # Clamp to valid submission range — evaluator rejects 0.0 and 1.0
        final_score = min(max(final_score, 0.01), 0.99)
    except Exception:
        logger.warning("Could not parse final score; defaulting to 0.01.")
        final_score = 0.01

    logger.info(
        "Episode complete — task=%s steps=%d score=%.3f success=%s",
        task_name, step_count, final_score, success_str,
    )
    # Evaluator-required [END] line
    print(
        f"[END] success={success_str} steps={step_count} "
        f"score={final_score:.3f} rewards={rewards_str}"
    )


if __name__ == "__main__":
    # Default task list used during local validation and CI runs
    test_tasks: list[str] = ["easy_001", "medium_001", "hard_001"]
    logger.info("Starting inference run for %d tasks using provider: %s", len(test_tasks), PROVIDER)
    for t in test_tasks:
        run_task(t)
    logger.info("Inference run complete.")
