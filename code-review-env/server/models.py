from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Action(BaseModel):
    model_config = ConfigDict(strict=False)

    line: int
    severity: str
    category: str
    message: str
    fix: str
    done: bool = False

    @field_validator("severity")
    @classmethod
    def normalize_severity(cls, value: str) -> str:
        return value.lower()

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.lower()


class EventRecord(BaseModel):
    model_config = ConfigDict(strict=False)

    type: str
    timestamp: str
    payload: dict[str, Any] = Field(default_factory=dict)


class Observation(BaseModel):
    model_config = ConfigDict(strict=False)

    diff: str
    filename: str
    step: int
    max_steps: int
    comments_so_far: list[Any] = Field(default_factory=list)
    current_score: float
    score_delta: float
    bugs_remaining_hint: int
    task_type: str
    episode_id: str = ""
    task_name: str = ""
    hints_remaining: int = 0


class StepResult(BaseModel):
    model_config = ConfigDict(strict=False)

    observation: Observation
    reward: float
    done: bool
    info: dict[str, Any]

class ResetRequest(BaseModel):
    model_config = ConfigDict(strict=False)
    task_name: str | None = None
    model_name: str | None = "gemini-1.5-flash"


class ResetResult(BaseModel):
    model_config = ConfigDict(strict=False)

    observation: Observation
    info: dict[str, Any]


class StateResult(BaseModel):
    model_config = ConfigDict(strict=False)

    observation: Observation
    step: int
    done: bool
    total_reward: float
    performance_trend: str = "stable"
    success: bool = False
    episode_id: str = ""
    task_name: str = ""
    latest_event: EventRecord | None = None
    started_at: str | None = None
    finished_at: str | None = None
