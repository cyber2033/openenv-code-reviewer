# AI Code Review Environment

This is a production-grade Hugging Face / OpenEnv compatible evaluation environment for autonomous code review agents.

## Environments and Difficulty
- **Easy**: (10 steps) - Find basic logic and syntax bugs in clean python snippets.
- **Medium**: (15 steps) - Discover Flask security vulnerabilities.
- **Hard**: (20 steps) - Discover subtle cryptographic and logic bypasses in GitHub-style `diff` contexts.

## Execution
Make sure your API keys and tokens are exported.
```sh
export API_BASE_URL="https://api.openai.com/v1"
export HF_TOKEN="your-token"
export MODEL_NAME="gpt-3.5-turbo"
```

On Windows, the project now includes launcher scripts at the repo root:
```bat
run_all.bat
```
Starts the backend, starts the React dashboard, refreshes datasets, and opens the browser.

```bat
run.bat
```
Starts only the FastAPI backend and opens the built-in dashboard.

To run the pipeline and log output format dynamically:
```sh
python inference.py
```

## Reward Structure
- Raw score maps to exactly `[0.0, 1.0]`. Score rewards are delta calculations updated precisely across actions.
- Action spamming or duplicate lines yields rigorous linear/proportional score penalties directly mitigating exploitation tactics natively inside the application.

## Project Structure

```text
Bangluru Hakathon/
├── run_all.bat                         # ▶️ Main startup script (boots FastAPI & opens browser)
├── run.bat                             # Secondary startup script
├── requirements.txt                    # Root dependency list
└── code-review-env/                    # 📁 Main Hackathon Project Scope
    ├── .port                           # (Auto-generated) Stores dynamic active port
    ├── Dockerfile                      # Production container image configurations
    ├── inference.py                    # Evaluator script (reads API keys, pings tasks via OpenAI)
    ├── openenv.yaml                    # Official Hackathon challenge bounds/schema definitions
    ├── README.md                       # Official Hackathon project structure markdown
    ├── requirements.txt                # Core packages required for the project
    │
    ├── dataset/                        # 📁 JSON Ground Truth Data (Raw)
    │   ├── easy_bugs.json
    │   ├── medium_bugs.json
    │   └── hard_bugs.json
    │
    └── server/                         # 📁 Core Backend Application Operations
        ├── main.py                     # FastAPI routes (/step, /reset, /health, /docs) + Port Logic
        ├── models.py                   # Pydantic v2 exact validation schemas
        ├── grader.py                   # Anti-spam/Reward distance calculation algorithms
        │
        └── tasks/                      # 📁 Challenge Environments
            ├── easy.py                 # Pure Python script bugs (ZeroDivision, off-by-one)
            ├── medium.py               # Flask application vulnerabilities (Path traversal, SQLi)
            └── hard.py                 # Multi-file Github commit diffs (TOCTOU, race conditions)
```
