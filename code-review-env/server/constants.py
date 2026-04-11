"""
Module: constants.py
Purpose: Centralized constants for the OpenEnv AI Code Review Environment.
         All magic numbers and configuration values are defined here to
         ensure consistency across grader, main, and agent modules.
Project: OpenEnv AI Code Review Environment
"""

# ---------------------------------------------------------------------------
# Step limits per difficulty tier
# ---------------------------------------------------------------------------
MAX_STEPS_EASY: int = 6
MAX_STEPS_MEDIUM: int = 8
MAX_STEPS_HARD: int = 10

# ---------------------------------------------------------------------------
# Valid severity levels and bug categories accepted by the API
# ---------------------------------------------------------------------------
SEVERITY_LEVELS: list[str] = ["critical", "high", "medium", "low"]
CATEGORIES: list[str] = [
    "security",
    "logic",
    "null_check",
    "type_error",
    "performance",
    "style",
]

# ---------------------------------------------------------------------------
# Scoring rewards and penalties (Easy tier)
# ---------------------------------------------------------------------------
TRUE_POSITIVE_REWARD: float = 0.25      # Reward for each matched ground truth bug
SEVERITY_MATCH_BONUS: float = 0.10     # Bonus when severity label is correct
FALSE_POSITIVE_PENALTY: float = 0.10   # Penalty for each unmatched comment

# ---------------------------------------------------------------------------
# Anti-spam penalties
# ---------------------------------------------------------------------------
ANTI_SPAM_PENALTY: float = 0.15        # Per extra comment beyond 2 on same line
ANTI_SPAM_BULK_PENALTY: float = 0.20   # Bulk penalty when comments > ground_truth * 3
ANTI_SPAM_MAX_PER_LINE: int = 2        # Max comments allowed on a single line

# ---------------------------------------------------------------------------
# Hint system
# ---------------------------------------------------------------------------
HINT_PENALTY: float = 0.05             # Score penalty per hint consumed
MAX_HINTS: int = 3                     # Maximum hints per episode

# ---------------------------------------------------------------------------
# Line-matching tolerance per difficulty
# ---------------------------------------------------------------------------
EASY_LINE_TOLERANCE: int = 3           # ±3 lines allowed for easy tasks
MEDIUM_LINE_TOLERANCE: int = 2         # ±2 lines allowed for medium tasks
HARD_LINE_TOLERANCE: int = 0           # Exact line match required for hard tasks

# ---------------------------------------------------------------------------
# Storage limits
# ---------------------------------------------------------------------------
MAX_EVENT_HISTORY: int = 50            # Circular buffer size for WebSocket events
MAX_LEADERBOARD_ENTRIES: int = 100     # Maximum entries in the leaderboard

# ---------------------------------------------------------------------------
# Success thresholds per difficulty
# ---------------------------------------------------------------------------
MEDIUM_SUCCESS_PRECISION: float = 0.50
MEDIUM_SUCCESS_SCORE: float = 0.65
HARD_SUCCESS_PRECISION: float = 0.60
HARD_SUCCESS_SCORE: float = 0.75

# ---------------------------------------------------------------------------
# Score clamping
# ---------------------------------------------------------------------------
SCORE_MIN: float = 0.01
SCORE_MAX: float = 0.99
REWARD_MIN: float = 0.01
REWARD_MAX: float = 0.35

# ---------------------------------------------------------------------------
# Default model name
# ---------------------------------------------------------------------------
DEFAULT_MODEL: str = "gemini-1.5-flash"
