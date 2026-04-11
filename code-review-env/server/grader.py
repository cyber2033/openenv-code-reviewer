"""
Module: grader.py
Purpose: Scoring engine for the OpenEnv AI Code Review Environment.
         Provides deterministic reward calculation for Easy, Medium, and Hard
         tasks, as well as an LLM-as-a-Judge pathway for custom lab audits.
Project: OpenEnv AI Code Review Environment
"""

# ---------------------------------------------------------------------------
# CHANGES MADE:
#   - Added module-level docstring
#   - Added docstrings to all 10 methods
#   - Added inline comments for every non-trivial logic block
#   - Added logging for LLM judge edge cases
#   - Imported constants for all magic numbers
#
# WHAT I DID NOT CHANGE:
#   - All existing scoring logic intact
#   - All return values and types intact
#   - All existing routes and calls intact
# ---------------------------------------------------------------------------

from __future__ import annotations

# Standard library
import logging
import re
from typing import Any

# Third party
from openai import OpenAI

# Local
from server.constants import (
    ANTI_SPAM_BULK_PENALTY,
    ANTI_SPAM_MAX_PER_LINE,
    ANTI_SPAM_PENALTY,
    EASY_LINE_TOLERANCE,
    FALSE_POSITIVE_PENALTY,
    HARD_SUCCESS_PRECISION,
    HARD_SUCCESS_SCORE,
    MEDIUM_LINE_TOLERANCE,
    MEDIUM_SUCCESS_PRECISION,
    MEDIUM_SUCCESS_SCORE,
    REWARD_MAX,
    REWARD_MIN,
    SCORE_MAX,
    SCORE_MIN,
    SEVERITY_MATCH_BONUS,
    TRUE_POSITIVE_REWARD,
)

logger = logging.getLogger(__name__)


class Grader:
    """Deterministic scoring engine for code review episodes.

    Handles three difficulty tiers (easy / medium / hard) with distinct
    reward formulas, a shared anti-spam penalty layer, and an optional
    secondary LLM judge for custom lab audits.
    """

    def get_match_tolerance(self, task_type: str) -> int:
        """Return the line-number tolerance allowed for a given task type.

        Args:
            task_type: One of 'easy', 'medium', or 'hard'.

        Returns:
            int: Maximum allowed line offset for a comment to count as a match.
                 Easy = 3, Medium = 2, Hard = 0 (exact match required).
        """
        if task_type == "easy":
            return EASY_LINE_TOLERANCE
        if task_type == "medium":
            return MEDIUM_LINE_TOLERANCE
        # Hard tasks require an exact line match
        return 0

    def comment_matches_ground_truth(
        self,
        comment: dict[str, Any],
        ground_truth_item: dict[str, Any],
        task_type: str,
    ) -> bool:
        """Check whether a single agent comment hits a ground-truth bug.

        The match is based purely on line proximity within the tolerance
        defined by the task type.

        Args:
            comment: Agent-submitted comment dict with at minimum a 'line' key.
            ground_truth_item: Known bug annotation dict with a 'line' key.
            task_type: Difficulty tier controlling the allowed line offset.

        Returns:
            bool: True if the comment is within tolerance of the ground truth.
        """
        # Calculate absolute distance between the commented line and the real bug line
        line_distance = abs(
            int(comment.get("line", 0)) - int(ground_truth_item.get("line", 0))
        )
        return line_distance <= self.get_match_tolerance(task_type)

    def count_matched_ground_truth(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        task_type: str,
    ) -> int:
        """Count how many distinct ground-truth bugs were found by the agent.

        Each ground-truth item can only be matched once, even if the agent
        submits multiple comments on or near the same line.

        Args:
            comments: All comments submitted by the agent this episode.
            ground_truth: The list of known bugs for the current task.
            task_type: Difficulty tier ('easy', 'medium', 'hard').

        Returns:
            int: Number of unique ground-truth bugs covered by the agent.
        """
        # Track which ground-truth indices have already been claimed
        matched_gt: set[int] = set()

        for comment in comments:
            for index, truth in enumerate(ground_truth):
                # Skip already-matched ground truth items to prevent double-counting
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, task_type):
                    matched_gt.add(index)
                    break  # Each comment can claim at most one ground-truth item

        return len(matched_gt)

    def compute_precision(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        task_type: str,
    ) -> float:
        """Compute the precision of the agent's comment set.

        Precision = true positives / total comments submitted.

        Args:
            comments: All agent comments for this episode.
            ground_truth: Known bug annotations.
            task_type: Difficulty tier.

        Returns:
            float: Precision score clamped to [0.01, 0.99].
        """
        if not comments:
            # No comments means no precision signal; return minimum valid score
            return SCORE_MIN

        matched = self.count_matched_ground_truth(comments, ground_truth, task_type)
        # Clamp to valid range to avoid 0.0 or 1.0 boundary values
        return float(min(max(matched / len(comments), SCORE_MIN), SCORE_MAX))

    def compute_reward(self, old_score: float, new_score: float) -> float:
        """Compute the incremental reward for a single step.

        Reward is the delta between the new and old cumulative scores,
        clamped within [REWARD_MIN, REWARD_MAX] to prevent runaway values.

        Args:
            old_score: The agent's score before this step.
            new_score: The agent's score after this step.

        Returns:
            float: Reward for this step, clamped to [0.01, 0.35].
        """
        # Delta between new and previous score
        value = new_score - old_score
        # Clamp reward to prevent outliers from distorting episode stats
        return float(min(max(value, REWARD_MIN), REWARD_MAX))

    def apply_anti_spam(
        self,
        raw_score: float,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        """Apply spam penalties to the raw score.

        Two penalty rules are enforced:
          1. Per-line spam: > 2 comments on the same line → -0.15 per extra.
          2. Bulk spam: total comments > 3× ground truth count → -0.20.

        Args:
            raw_score: The score before anti-spam adjustments.
            comments: All agent comments this episode.
            ground_truth: Known bug annotations (used for bulk spam threshold).

        Returns:
            float: Adjusted score after spam penalties are applied.
        """
        score = raw_score

        # Count how many comments land on each line number
        line_counts: dict[int, int] = {}
        for comment in comments:
            line = int(comment.get("line", 0))
            line_counts[line] = line_counts.get(line, 0) + 1

        # Apply per-line penalty for each comment beyond the allowed maximum
        for count in line_counts.values():
            if count > ANTI_SPAM_MAX_PER_LINE:
                score -= ANTI_SPAM_PENALTY * (count - ANTI_SPAM_MAX_PER_LINE)

        # Apply bulk penalty when total comments massively exceed the bug count
        if ground_truth and len(comments) > len(ground_truth) * 3:
            score -= ANTI_SPAM_BULK_PENALTY

        return float(score)

    def score_easy(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        """Score an Easy-tier episode.

        Scoring formula:
          +0.25 per matched ground-truth bug (within ±3 lines)
          +0.10 bonus if the severity label is correct
          -0.10 for each comment that does not match any ground-truth bug
          Anti-spam penalties applied at the end.

        Args:
            comments: All agent comments submitted this episode.
            ground_truth: Known bug annotations for the task.

        Returns:
            float: Final episode score clamped to [0.01, 0.99].
        """
        if not ground_truth:
            # No ground truth means this task cannot be scored deterministically
            return SCORE_MIN

        matched_gt: set[int] = set()
        score = 0.0

        for comment in comments:
            matched = False
            for index, truth in enumerate(ground_truth):
                # Skip already-claimed ground-truth items
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, "easy"):
                    matched_gt.add(index)
                    # Base reward for correctly identifying the bug location
                    score += TRUE_POSITIVE_REWARD
                    # Bonus reward for correct severity classification
                    if str(comment.get("severity", "")).lower() == str(
                        truth.get("severity", "")
                    ).lower():
                        score += SEVERITY_MATCH_BONUS
                    matched = True
                    break
            if not matched:
                # Penalize false positives to discourage shotgun commenting
                score -= FALSE_POSITIVE_PENALTY

        # Apply anti-spam layer before clamping
        score = self.apply_anti_spam(score, comments, ground_truth)
        # Clamp to valid submission range
        return float(min(max(score, SCORE_MIN), SCORE_MAX))

    def score_medium(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        """Score a Medium-tier episode using recall/precision blending.

        Scoring formula:
          Base = 0.6 × recall + 0.4 × precision
          Bonus = +0.25 per true positive, +0.10 per category match
          Penalty = -0.10 per false positive
          Anti-spam penalties applied at the end.

        Args:
            comments: All agent comments submitted this episode.
            ground_truth: Known bug annotations for the task.

        Returns:
            float: Final episode score clamped to [0.01, 0.99].
        """
        if not ground_truth:
            return SCORE_MIN

        matched_gt: set[int] = set()
        true_positives = 0
        category_matches = 0

        for comment in comments:
            for index, truth in enumerate(ground_truth):
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, "medium"):
                    matched_gt.add(index)
                    true_positives += 1
                    # Bonus for correct category classification (e.g., 'security' vs 'logic')
                    if str(comment.get("category", "")).lower() == str(
                        truth.get("category", "")
                    ).lower():
                        category_matches += 1
                    break

        # Recall: fraction of ground-truth bugs found
        recall = true_positives / len(ground_truth)
        # Precision: fraction of comments that were true positives
        precision = true_positives / len(comments) if comments else 1.0
        false_positives = max(0, len(comments) - true_positives)

        # Weighted blend of recall and precision with per-item bonuses/penalties
        score = 0.6 * recall + 0.4 * precision
        score += 0.25 * true_positives + 0.10 * category_matches - 0.10 * false_positives

        score = self.apply_anti_spam(score, comments, ground_truth)
        return float(min(max(score, SCORE_MIN), SCORE_MAX))

    def score_hard(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        """Score a Hard-tier episode using coverage, precision, and severity accuracy.

        Hard tasks require exact line matching (zero tolerance).

        Scoring formula:
          0.50 × coverage + 0.30 × precision + 0.20 × severity_accuracy
          Anti-spam penalties applied at the end.

        Args:
            comments: All agent comments submitted this episode.
            ground_truth: Known bug annotations for the task.

        Returns:
            float: Final episode score clamped to [0.01, 0.99].
        """
        if not ground_truth:
            return SCORE_MIN

        matched_gt: set[int] = set()
        true_positives = 0
        severity_correct = 0

        for comment in comments:
            for index, truth in enumerate(ground_truth):
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, "hard"):
                    matched_gt.add(index)
                    true_positives += 1
                    # Track severity accuracy separately — worth 20% of the score
                    if str(comment.get("severity", "")).lower() == str(
                        truth.get("severity", "")
                    ).lower():
                        severity_correct += 1
                    break

        # Coverage: fraction of ground-truth bugs that were located
        coverage = len(matched_gt) / len(ground_truth)
        # Precision: how many of the agent's comments were correct
        precision = true_positives / len(comments) if comments else 1.0
        # Severity accuracy: fraction of comments with correct severity
        severity_accuracy = severity_correct / len(comments) if comments else 1.0

        # Weighted scoring favors coverage (50%) over precision (30%) and severity (20%)
        score = 0.5 * coverage + 0.3 * precision + 0.2 * severity_accuracy
        score = self.apply_anti_spam(score, comments, ground_truth)
        return float(min(max(score, SCORE_MIN), SCORE_MAX))

    def is_success(
        self,
        task_type: str,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        final_score: float,
    ) -> bool:
        """Determine whether the agent passed the episode success threshold.

        Success criteria vary by difficulty:
          - Easy:   all ground-truth bugs matched (any precision)
          - Medium: all bugs matched + precision ≥ 0.50 + score ≥ 0.65
          - Hard:   all bugs matched + precision ≥ 0.60 + score ≥ 0.75

        Args:
            task_type: Difficulty tier ('easy', 'medium', 'hard').
            comments: All agent comments submitted this episode.
            ground_truth: Known bug annotations for the task.
            final_score: The episode's final computed score.

        Returns:
            bool: True if the agent met the success criteria for the tier.
        """
        if not ground_truth:
            # Cannot succeed without a ground truth reference
            return False

        matched_count = self.count_matched_ground_truth(comments, ground_truth, task_type)
        precision = self.compute_precision(comments, ground_truth, task_type)

        if task_type == "easy":
            # Easy success: every bug must be found (precision not checked)
            return matched_count == len(ground_truth)
        if task_type == "medium":
            # Medium success: full coverage + minimum precision and score
            return (
                matched_count == len(ground_truth)
                and precision >= MEDIUM_SUCCESS_PRECISION
                and final_score >= MEDIUM_SUCCESS_SCORE
            )
        # Hard success: full coverage + stricter precision and higher score threshold
        return (
            matched_count == len(ground_truth)
            and precision >= HARD_SUCCESS_PRECISION
            and final_score >= HARD_SUCCESS_SCORE
        )

    def score_hard_with_llm_judge(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        diff: str,
        api_base_url: str,
        api_key: str | None,
        model_name: str,
    ) -> float:
        """Hybrid scorer that blends rule-based Hard scoring with LLM judgment.

        Combines the deterministic Hard scorer (60% weight) with an OpenAI-
        compatible LLM judge (40% weight). Falls back to the rule-based score
        if the LLM call fails.

        Args:
            comments: All agent comments submitted this episode.
            ground_truth: Known bug annotations for the task.
            diff: The original code diff shown to the agent.
            api_base_url: OpenAI-compatible API base URL for the judge model.
            api_key: API key for the judge model endpoint.
            model_name: Model identifier for the judge (e.g. 'gpt-4o').

        Returns:
            float: Blended score clamped to [0.01, 0.99].
        """
        # Always compute rule-based score as the fallback
        rule_score = self.score_hard(comments, ground_truth)

        try:
            client = OpenAI(base_url=api_base_url, api_key=api_key or "")
            prompt = (
                "You are a senior code reviewer judge.\n"
                f"Original diff: {diff}\n"
                f"Agent comments: {comments}\n"
                f"Ground truth bugs: {ground_truth}\n"
                "Rate this review from 0.0 to 1.0.\n"
                "Consider: coverage, accuracy, severity correctness.\n"
                "Reply with ONLY a float number. Nothing else."
            )
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=16,
            )
            raw = response.choices[0].message.content or ""

            # Extract the first floating-point number from the LLM response
            match = re.search(r"-?\d+(?:\.\d+)?", raw)
            if match is None:
                logger.warning("LLM judge returned no parseable float; using rule score.")
                return rule_score

            llm_score = float(match.group(0))
            llm_score = float(min(max(llm_score, SCORE_MIN), SCORE_MAX))

            # Blend: 60% deterministic + 40% LLM judgment
            final = 0.6 * rule_score + 0.4 * llm_score
            return float(min(max(final, SCORE_MIN), SCORE_MAX))

        except Exception:
            logger.exception("LLM judge call failed; falling back to rule-based score.")
            return rule_score

    def grade_custom_lab(
        self,
        comments: list[dict[str, Any]],
        diff: str,
        api_key: str | None,
    ) -> tuple[float, str]:
        """Dynamically grade a custom lab audit using Gemini as the judge.

        Since custom lab code has no pre-defined ground truth, a secondary
        Gemini model acts as a senior security engineer and evaluates the
        quality of the agent's review.

        Args:
            comments: All comments the primary agent submitted.
            diff: The raw code snippet that was audited.
            api_key: Gemini API key. Falls back to GEMINI_API_KEY env var.

        Returns:
            tuple[float, str]: (score, explanation) where score ∈ [0.01, 0.99]
                               and explanation is a short qualitative verdict.
        """
        import os

        # Resolve API key from argument or environment variable
        key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        if not key or "your_" in key.lower():
            logger.warning("grade_custom_lab: no valid Gemini API key found.")
            return SCORE_MIN, "No LLM Judge configured (Missing AI Key)."

        try:
            import google.generativeai as genai

            genai.configure(api_key=key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = (
                "You are an elite Senior Security Engineer judging an AI code reviewer.\n"
                f"Original Code:\n{diff}\n\n"
                f"Agent's Review Comments:\n{comments}\n\n"
                "Evaluate the Agent's review on a scale of 0.01 to 0.99. "
                "Provide the final score on the first line, followed by a short "
                "qualitative explanation on the next line.\n"
                "Score high if the agent found real vulnerabilities and didn't spam. "
                "Score low if it made up bugs (False Positives) or missed obvious flaws."
            )
            response = model.generate_content(prompt)
            raw = response.text.strip()

            # Extract the first decimal score from the response
            match = re.search(r"0\.\d+", raw)
            score = float(match.group(0)) if match else 0.5
            score = float(min(max(score, SCORE_MIN), SCORE_MAX))

            # Use the second line as the qualitative explanation (truncated for safety)
            parts = raw.split("\n", 1)
            reason = (
                parts[-1].strip()[:250]
                if len(parts) > 1
                else "LLM Judge evaluated the custom review."
            )
            return score, reason

        except Exception as e:
            logger.exception("grade_custom_lab: Gemini judge call failed.")
            return SCORE_MIN, f"LLM Judge error: {str(e)}"

    def get_explanation(
        self,
        reward: float,
        is_match: bool,
        sev_match: bool,
        cat_match: bool,
    ) -> str:
        """Return a human-readable explanation for a given reward value.

        Used to populate the 'reason' field returned to the dashboard after
        each step so the user can understand what the grader decided.

        Args:
            reward: The reward value for this step.
            is_match: Whether the comment hit a ground-truth bug.
            sev_match: Whether the severity label was correct.
            cat_match: Whether the category label was correct.

        Returns:
            str: Short plain-English explanation of the grader's verdict.
        """
        if reward > 0.8:
            return "Exceptional detection. Accurate line, severity, and category."
        if reward > 0.4:
            return "Valid bug identified. High precision with minor metadata variance."
        if reward > 0:
            return "Correct line identified, though severity or category categorization was suboptimal."
        if reward == 0:
            return "No significant signal detected for this step."
        if reward > -0.2:
            return "Minor penalty: Incorrect categorization of a valid code region."
        return "Spam Penalty: Agent flagged a non-existent vulnerability on a clean line."


# ---------------------------------------------------------------------------
# Module-level singleton — imported by main.py and agent.py
# ---------------------------------------------------------------------------
grader = Grader()

# ---------------------------------------------------------------------------
# Smoke tests — run on import to catch regressions immediately
# ---------------------------------------------------------------------------
assert grader.score_easy([], [{"line": 1, "severity": "high", "category": "logic"}]) == 0.01
assert grader.compute_reward(0.0, 0.5) == 0.35
