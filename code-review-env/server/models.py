"""
Module: models.py
Purpose: Pydantic request/response models for the OpenEnv AI Code Review API.
         All models use strict=False to allow type coercion from JSON payloads.
Project: OpenEnv AI Code Review Environment
"""

# ---------------------------------------------------------------------------
# CHANGES MADE:
#   - Added module-level docstring
#   - Added class-level docstrings to all 6 models
#   - Added field-level docstrings / inline comments
#   - Added docstrings to all validator methods
#
# WHAT I DID NOT CHANGE:
#   - All field definitions unchanged
#   - All validators unchanged
#   - All model configs unchanged
# ---------------------------------------------------------------------------

# Standard library
from typing import Any

# Third party
from pydantic import BaseModel, ConfigDict, Field, field_validator


class Action(BaseModel):
    """A single review action submitted by the agent to the /step endpoint.

    Each action represents one bug comment. The agent may submit multiple
    actions per episode (up to max_steps). Setting `done=True` signals that
    the agent has finished its review.
    """

    model_config = ConfigDict(strict=False)

    line: int
    """Line number in the diff where the bug was found (1-indexed)."""

    severity: str
    """Bug severity label: 'critical', 'high', 'medium', or 'low'."""

    category: str
    """Bug category label: e.g. 'security', 'logic', 'null_check'."""

    message: str
    """Human-readable explanation of the bug."""

    fix: str
    """Proposed code fix or remediation advice."""

    done: bool = False
    """If True, the agent declares the episode finished after this step."""

    @field_validator("severity")
    @classmethod
    def normalize_severity(cls, value: str) -> str:
        """Normalize severity to lowercase for consistent comparison.

        Args:
            value: Raw severity string from the request payload.

        Returns:
            str: Lowercase severity string.
        """
        return value.lower()

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        """Normalize category to lowercase for consistent comparison.

        Args:
            value: Raw category string from the request payload.

        Returns:
            str: Lowercase category string.
        """
        return value.lower()


class EventRecord(BaseModel):
    """A single server-side event broadcast over the WebSocket connection.

    Events are emitted for episode resets, each scored step, episode
    completion, hint issuance, and leaderboard updates.
    """

    model_config = ConfigDict(strict=False)

    type: str
    """Event type identifier, e.g. 'step_scored', 'episode_finished'."""

    timestamp: str
    """ISO-8601 UTC timestamp string when the event was emitted."""

    payload: dict[str, Any] = Field(default_factory=dict)
    """Arbitrary event-specific data attached to this event."""


class Observation(BaseModel):
    """The agent's view of the environment after a reset or step.

    Returned inside ResetResult and StepResult so the agent always knows
    the current episode state without making extra API calls.
    """

    model_config = ConfigDict(strict=False)

    diff: str
    """The code diff the agent must review (unified diff format)."""

    filename: str
    """Name of the file being reviewed (e.g. 'snippet.py')."""

    step: int
    """Current step number (0 after reset, increments on each /step call)."""

    max_steps: int
    """Maximum steps allowed before the episode ends automatically."""

    comments_so_far: list[Any] = Field(default_factory=list)
    """All comments submitted by the agent so far this episode."""

    current_score: float
    """Cumulative score after all steps so far."""

    score_delta: float
    """Reward received for the most recent step."""

    bugs_remaining_hint: int
    """Estimated number of ground-truth bugs not yet found (hint only)."""

    task_type: str
    """Difficulty tier: 'easy', 'medium', or 'hard'."""

    episode_id: str = ""
    """UUID identifying the current episode for replay and export."""

    task_name: str = ""
    """Task identifier string, e.g. 'easy_001' or 'lab_audit'."""

    hints_remaining: int = 0
    """How many hints the agent can still request this episode."""


class StepResult(BaseModel):
    """Response returned by the /step endpoint after each agent action."""

    model_config = ConfigDict(strict=False)

    observation: Observation
    """Updated observation reflecting the state after this step."""

    reward: float
    """Incremental reward earned for this step."""

    done: bool
    """True if the episode has ended (agent declared done or max steps reached)."""

    info: dict[str, Any]
    """Extra metadata such as the grader's human-readable 'reason' string."""


class ResetRequest(BaseModel):
    """Request body accepted by the /reset endpoint."""

    model_config = ConfigDict(strict=False)

    task_name: str | None = None
    """Task to load. Defaults to 'easy_001' if omitted."""

    model_name: str | None = "gemini-1.5-flash"
    """LLM model identifier stored for leaderboard attribution."""


class ResetResult(BaseModel):
    """Response returned by the /reset endpoint after a successful reset."""

    model_config = ConfigDict(strict=False)

    observation: Observation
    """Initial observation with the task diff and empty comment list."""

    info: dict[str, Any]
    """Confirmation metadata (e.g. {'message': 'ok'})."""


class StateResult(BaseModel):
    """Response returned by the GET /state endpoint.

    Provides a full snapshot of the current episode state without
    consuming a step. Used by the dashboard to poll for updates.
    """

    model_config = ConfigDict(strict=False)

    observation: Observation
    """Current observation including all comments submitted so far."""

    step: int
    """Current step counter."""

    done: bool
    """True if the episode has ended."""

    total_reward: float
    """Sum of all rewards earned this episode."""

    performance_trend: str = "stable"
    """Qualitative trend label: 'improving', 'stable', or 'declining'."""

    success: bool = False
    """True if the agent met the success threshold for this difficulty tier."""

    episode_id: str = ""
    """UUID of the active episode."""

    task_name: str = ""
    """Task identifier string for the active episode."""

    latest_event: EventRecord | None = None
    """The most recent WebSocket event emitted by the server."""

    started_at: str | None = None
    """ISO-8601 UTC timestamp when the episode was started."""

    finished_at: str | None = None
    """ISO-8601 UTC timestamp when the episode ended (None if still running)."""
