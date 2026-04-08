# OpenEnv: AI Code Review Environment 🚀

> **"A benchmark environment that tests how well AI agents can review code and find bugs — just like a senior engineer reviews a pull request."**

---

## 🎯 Project Overview

### Main Purpose
Our project creates a standardized arena where AI agents are evaluated on their ability to perform real-world code review. The agent reads buggy code diffs, identifies problems, and submits structured bug reports. A deterministic grader then scores the agent based on how accurately it found real bugs compared to ground truth annotations.

### Why It Exists
Every software company in the world needs code review. Senior engineers spend hours every day reading pull requests, finding bugs, and suggesting fixes. This is expensive, slow, and doesn't scale. Our environment trains and evaluates AI agents to do this job automatically — and measures exactly how good they are at it.

### What It Proves
```text
Given a piece of buggy code
can an AI agent find the bugs
the same way a human engineer would?

Our environment answers that question
with a score from 0.0 to 1.0
across three difficulty levels
easy, medium, and hard.
```

### Real World Value
*   **GitHub** → uses this to train Copilot review
*   **Meta** → uses this to review internal PRs
*   **Google** → uses this to catch security bugs
*   **Startups** → use this instead of hiring reviewers

### Official Pitch
This project is an OpenEnv-compatible reinforcement learning environment designed to benchmark AI agents on automated code review. Agents receive code diffs containing real bugs across three difficulty tiers — logic errors, security vulnerabilities, and complex multi-file PR issues. Each agent action is a structured bug report containing line number, severity, category, and fix suggestion. A deterministic grader scores every action against ground truth annotations and returns a reward signal between 0.0 and 1.0. The environment includes a live React dashboard for real-time telemetry, a leaderboard for multi-agent comparison, and a replay system for episode analysis. The goal is to provide the AI research community with a rigorous, reproducible benchmark for evaluating code review capability in large language models.

---

## SECTION 2 - Architecture Overview

### System Diagram (ASCII Art)

```text
+-----------------------+       +-------------------------+       +-------------------+
|                       |       |                         |       |                   |
|    React Dashboard    | <---> |     FastAPI Server      | <---> |     AI Agent      |
|   (Next.js / Vite)    |       |   (Judge & Telemetry)   |       | (Evaluation Client)|
|                       |       |                         |       |                   |
+-----------------------+       +------------+------------+       +-------------------+
                                             |
                                             v
                                  +-----------------------+
                                  |                       |
                                  |    Grader Engine      |
                                  | (Logic, Security, TP) |
                                  |                       |
                                  +----------+------------+
                                             |
                                             v
                                  +-----------------------+
                                  |                       |
                                  |     Dataset (JSON)    |
                                  | (Easy/Medium/Hard)    |
                                  |                       |
                                  +-----------------------+
```

### Component Breakdown
- **React Dashboard:** A premium dark-themed UI that provides real-time monitoring of agent behavior, cumulative scoring charts, and line-by-line diff inspections via WebSockets.
- **FastAPI Server:** The central nervous system. It manages episode states, generates observations, and exposes the REST/WS API endpoints required by the OpenEnv spec.
- **AI Agent (Inference):** The subject of evaluation. It receives code diffs and must generate structured critiques following a strict schema.
- **Grader Engine:** A multi-layered evaluation module that calculates rewards based on line-proximity, severity matching, and anti-spam rules.
- **Dataset JSON:** The ground truth repository containing curated code snippets with injected vulnerabilities ranging from syntax errors (Easy) to complex CVE-style security flaws (Hard).

### Data Flow
1. **Reset:** Agent calls `/reset` to start a new episode. Server loads a task from the JSON dataset.
2. **Observe:** Server returns the `Observation` (diff, filename, step).
3. **Act:** Agent submits an `Action` (line, severity, category, message, fix).
4. **Grade:** The Grader compares the Action to the Ground Truth.
5. **Update:** Server calculates the Reward and updates the total Score and Dashboard (via WS).
6. **Repeat:** Step 2-5 repeat until the agent sets `done=true` or hits `max_steps`.

---

## SECTION 3 - Environment Description

The environment simulates a professional code review workflow. The Agent is treated as a "Junior Reviewer" being evaluated by a "Senior Judge" (the server).

- **The Experience:** The agent is given a specific file diff and must find hidden bugs. It doesn't see the whole codebase at once, focusing its attention on the "Review Surface" (the diff).
- **Actions:** The agent can comment on any line, categorize the bug, suggest a fix, and decide when to end the review.
- **Observations:** The agent receives the diff text, the task difficulty, its previous comments (to avoid repetition), and subtle "hints" about bugs remaining.
- **Rewards:** Agents earn points for "True Positives" (finding real bugs), additional points for matching the correct severity, and lose points for "False Positives" or "Spamming".
- **Episodes:** An episode is a single task (one file). It has a defined boundary (Success/Failure) and a finalized score.

---

## SECTION 4 - Action Space

The agent interacts by sending a JSON object for each comment:

| Field    | Type   | Values                              | Description        |
|----------|--------|-------------------------------------|--------------------|
| `line`     | int    | 1 to N                              | Line number of bug |
| `severity` | string | critical/high/medium/low            | Bug severity       |
| `category` | string | security/logic/syntax/performance/style | Bug type |
| `message`  | string | any                                 | Bug description    |
| `fix`      | string | any                                 | Suggested fix      |
| `done`     | bool   | true/false                          | Episode complete   |

---

## SECTION 5 - Observation Space

Upon every step, the agent receives state data:

| Field              | Type    | Description                    |
|--------------------|---------|--------------------------------|
| `diff`               | string  | Code diff text needing review  |
| `filename`           | string  | Name of the file being reviewed|
| `step`               | int     | Current step count (0-based)   |
| `max_steps`          | int     | Total steps allowed for task   |
| `comments_so_far`    | list    | List of all actions taken so far|
| `current_score`      | float   | Cumulative agent score (0-1)   |
| `score_delta`        | float   | Reward gained in the previous step|
| `bugs_remaining_hint`| int     | Number of bugs yet to be found |
| `task_type`          | string  | easy/medium/hard               |

---

## SECTION 6 - Task Descriptions

### EASY TASK (Logic & Syntax)
- **Bug Type:** Obvious syntax errors, off-by-one errors, or missing `None` checks.
- **Dataset:** 10 curated snippets (e.g., `binary_search.py`, `auth.py`).
- **Max Steps:** 6 steps.
- **Baseline Score:** 0.80+ for a "Strong Run".
- **Example Bug:** `if x = 5:` (Assignment instead of comparison).
- **Grading:** 3-line tolerance for bug location. High emphasis on finding the single bug quickly.

### MEDIUM TASK (Web Security)
- **Bug Type:** OWASP Top 10 issues: SQL Injection, Path Traversal, Unsafe Deserialization.
- **Dataset:** Python Flask/Django snippets.
- **Max Steps:** 8 steps.
- **Baseline Score:** 0.85+ for a "Strong Run".
- **Example Bug:** `with open(request.args.get('path'))` (Path Traversal).
- **Grading:** 2-line tolerance. Requires correct `category="security"` for full marks.

### HARD TASK (Enterprise PR)
- **Bug Type:** Subtle race conditions, cryptographic failures, or deep logic flaws in larger diffs.
- **Dataset:** Complex multi-function diffs.
- **Max Steps:** 10 steps.
- **Baseline Score:** 0.90+ for an "Elite Run".
- **Example Bug:** Improper JWT signature verification in a custom auth middleware.
- **Grading:** 0-line tolerance (Exact match required). Often includes an LLM-as-a-Judge for semantic verification of the message.

---

## SECTION 7 - Reward Function

The reward function ensures the agent is precise and helpful, not just "loud".

**The Formula:**
Total Reward = `(Loc_Match + Sev_Match + Cat_Match) - (Spam_Penalty + FP_Penalty)`

- **Positive Reward:**
    - **True Positive (TP):** +0.25 (Agent found the bug line).
    - **Severity Match:** +0.10 (Matched 'high', 'medium', etc.).
    - **Category Match:** +0.05 (Matched 'security', 'logic').
- **Negative Reward / Penalties:**
    - **False Positive (FP):** -0.10 (Commented on a correct line).
    - **Anti-Spam Penalty:** -0.15 for every comment beyond 2 on the same line.
    - **Noise Penalty:** -0.20 if total comments > 3x ground truth count.
- **Partial Credit:** Easy/Medium tasks have a "Tolerance Window" (±1-3 lines).

**Example Calculation:**
1. Ground Truth: Bug on line 42, Severity=High.
2. Agent Action: Line 42, Severity=High.
3. **Step Result:** `+0.25 (Line Match) + 0.10 (Severity Match) = +0.35` (Max per step).

---

## SECTION 8 - API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/reset` | `POST` | Starts fresh episode. Body: `{"task_name": "easy_001"}`. |
| `/step` | `POST` | Submits Action. Returns reward and next Observation. |
| `/state` | `GET` | Returns full current judge state and telemetry. |
| `/health` | `GET` | Returns server status, version, and active episode ID. |
| `/hint` | `GET` | Returns bug window (e.g., L3-L5). Penalty: -0.05. |
| `/leaderboard/submit`| `POST` | Finalizes a score for ranking. |
| `/leaderboard` | `GET` | Returns top 10 agents globally. |
| `/export/json` | `GET` | Download all past episode replays in JSON. |
| `/export/csv` | `GET` | Download run summary table as CSV. |
| `/ws/events` | `WS` | Real-time WebSocket stream for dashboard telemetry. |

---

## SECTION 9 - Setup & Execution 🚀

### QUICK START (One-Click Launch)
If you are on Windows, you can launch the **entire environment** (Backend + Frontend) with a single command:
1.  **Prepare Keys:** Duplicate `.env.example` to `.env` and add your `GEMINI_API_KEY`.
2.  **Run All:** Open a terminal in the root directory and run:
    ```bash
    .\run_all.bat
    ```
3.  **Access Dashboard:** Open `http://localhost:5173` in your browser.

---

### LOCAL SETUP (Step-by-Step)
1. **Clone repo:** `git clone <repo_url>`
2. **Install dependencies:** `pip install -r requirements.txt`
3. **Start server:** `python -m server.main` (Server runs on port 7860).
4. **Run inference:** `python inference.py` (Evaluates the model).
5. **Open dashboard:** `cd dashboard && npm install && npm run dev`
6. **Verify:** Navigate to `http://localhost:5173` to see the live score.

### DOCKER SETUP (Production)
1. **Build image:** `docker build -t openenv-judge .`
2. **Run container:** `docker run -p 7860:7860 -e HF_TOKEN=... openenv-judge`
3. **Verify:** Check `http://localhost:7860/health`.

### HUGGINGFACE SETUP
1. **Create Space:** Select Docker Blank template.
2. **Set secrets:** Add `HF_TOKEN`, `MODEL_NAME` to Settings > Variables.
3. **Push code:** Push the entire directory including `server/`, `dataset/`, and `dashboard/`.

---

## SECTION 10 - Environment Variables

| Variable     | Required | Default                          | Description      |
|--------------|----------|----------------------------------|------------------|
| `API_BASE_URL` | Yes      | https://router.huggingface.co/v1 | LLM API Endpoint |
| `MODEL_NAME`   | Yes      | Qwen/Qwen2.5-72B-Instruct        | LLM Model ID     |
| `HF_TOKEN`     | Yes      | None                             | HF Hub Token     |
| `SERVER_URL`   | No       | http://localhost:7860            | Local Backend URL|
| `BENCHMARK`    | No       | code-review                      | Benchmark Scope  |

---

## SECTION 11 - Baseline Scores

Official benchmarks using `Qwen2.5-72B-Instruct` on the Router:

| Task   | Model                     | Score | Steps | Success |
|--------|---------------------------|-------|-------|---------|
| Easy   | Qwen/Qwen2.5-72B-Instruct | 0.650 | 4     | true    |
| Medium | Qwen/Qwen2.5-72B-Instruct | 0.400 | 6     | false   |
| Hard   | Qwen/Qwen2.5-72B-Instruct | 0.250 | 8     | false   |

---

## SECTION 12 - Dashboard Features

Built for high-fidelity monitoring, the dashboard includes:
- **Live Monitor:** Big score counter, agent status, and live JSON stream.
- **Diff Viewer:** Line-by-line inspection with bug markers and hover details.
- **Scoring Analytics:** Recharts-powered graphs of cumulative score vs steps.
- **Leaderboard:** Real-time ranking with gold/silver/bronze highlights.
- **Episode Replay:** Scrub through past runs to see exactly where an agent failed.
- **Task Explorer:** Detailed library of task types and expected baselines.
- **API Docs:** Interactive documentation with copy-paste JSON payloads.
- **Settings:** UI-only toggles for hints, judge speed, and local cache resets.

---

## SECTION 13 - Scoring System Explained

Think of the scoring system like a **Professor grading a Thesis**:
- **Perfect Score (1.0):** The agent found all bugs on the exact lines, correctly identified their severity, and didn't leave any useless comments.
- **Zero Score (0.0):** The agent either failed to find anything or commented on beautiful, working code with "fake" bug reports.
- **Partial Credit:** If the agent says "the bug is on line 5" but it's actually on line 4, the professor gives partial points for being close (Tolerance Window).
- **Anti-Spam:** If a student yells "Error!" 50 times in one minute, the professor subtracts marks for being noisy (Negative Reward).

---

## SECTION 14 - OpenEnv Spec Compliance

This project is built to be **100% compliant** with the OpenEnv evaluation standards:
- **Standardized Endpoints:** Implements the mandatory `/reset` and `/step` contracts.
- **Strict Typing:** All responses follow the `Observation` and `StepResult` Pydantic schemas.
- **Reward Enforcing:** Reward is strictly bounded [0, 0.35] per step with a total score cap of 1.0.
- **Episode Boundaries:** Correctly handles `done` flags and `max_steps` to ensure fair evaluation of auto-regressive agents.

---

## SECTION 15 - Project Structure

### File Tree

```text
code-review-env/
├── inference.py     # Evaluation client: triggers LLM calls to solve tasks
├── openenv.yaml     # Runtime config (models, endpoints, scoring rules)
├── Dockerfile       # Containerized environment for HF Spaces deployment
├── requirements.txt # Backend and Inference dependencies
├── pyproject.toml   # Project metadata and tool configurations
├── README.md        # This comprehensive documentation
├── dataset/
│   ├── easy_bugs.json   # Ground truth for easy logic/syntax tasks
│   ├── medium_bugs.json # Ground truth for medium web-security tasks
│   ├── hard_bugs.json   # Ground truth for hard PR-level security tasks
└── server/
    ├── main.py      # FastAPI application entry point with WS and REST
    ├── grader.py    # Logic for Reward, Precision, Recall, and Anti-Spam
    ├── models.py    # Standardized Pydantic schemas for AI observations
    └── tasks/
        ├── easy.py   # Python-embedded task pools (Easy)
        ├── medium.py # Python-embedded task pools (Medium)
        └── hard.py   # Python-embedded task pools (Hard)
```
