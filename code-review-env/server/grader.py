from __future__ import annotations

import re
from typing import Any

from openai import OpenAI


class Grader:
    def get_match_tolerance(self, task_type: str) -> int:
        if task_type == "easy":
            return 3
        if task_type == "medium":
            return 2
        return 0

    def comment_matches_ground_truth(
        self,
        comment: dict[str, Any],
        ground_truth_item: dict[str, Any],
        task_type: str,
    ) -> bool:
        return (
            abs(int(comment.get("line", 0)) - int(ground_truth_item.get("line", 0)))
            <= self.get_match_tolerance(task_type)
        )

    def count_matched_ground_truth(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        task_type: str,
    ) -> int:
        matched_gt: set[int] = set()

        for comment in comments:
            for index, truth in enumerate(ground_truth):
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, task_type):
                    matched_gt.add(index)
                    break

        return len(matched_gt)

    def compute_precision(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        task_type: str,
    ) -> float:
        if not comments:
            return 0.01

        matched = self.count_matched_ground_truth(comments, ground_truth, task_type)
        return float(min(max(matched / len(comments), 0.01), 0.99))

    def compute_reward(self, old_score: float, new_score: float) -> float:
        value = new_score - old_score
        return float(min(max(value, 0.01), 0.35))

    def apply_anti_spam(
        self,
        raw_score: float,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        score = raw_score
        line_counts: dict[int, int] = {}

        for comment in comments:
            line = int(comment.get("line", 0))
            line_counts[line] = line_counts.get(line, 0) + 1

        for count in line_counts.values():
            if count > 2:
                score -= 0.15 * (count - 2)

        if ground_truth and len(comments) > len(ground_truth) * 3:
            score -= 0.20

        return float(score)

    def score_easy(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        if not ground_truth:
            return 0.01

        matched_gt: set[int] = set()
        score = 0.0

        for comment in comments:
            matched = False
            for index, truth in enumerate(ground_truth):
                if index in matched_gt:
                    continue
                if self.comment_matches_ground_truth(comment, truth, "easy"):
                    matched_gt.add(index)
                    score += 0.25
                    if str(comment.get("severity", "")).lower() == str(
                        truth.get("severity", "")
                    ).lower():
                        score += 0.10
                    matched = True
                    break
            if not matched:
                score -= 0.10

        score = self.apply_anti_spam(score, comments, ground_truth)
        return float(min(max(score, 0.01), 0.99))

    def score_medium(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        if not ground_truth:
            return 0.01

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
                    if str(comment.get("category", "")).lower() == str(
                        truth.get("category", "")
                    ).lower():
                        category_matches += 1
                    break

        recall = true_positives / len(ground_truth)
        precision = true_positives / len(comments) if comments else 1.0
        false_positives = max(0, len(comments) - true_positives)

        score = 0.6 * recall + 0.4 * precision
        score += 0.25 * true_positives + 0.10 * category_matches - 0.10 * false_positives
        score = self.apply_anti_spam(score, comments, ground_truth)
        return float(min(max(score, 0.01), 0.99))

    def score_hard(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
    ) -> float:
        if not ground_truth:
            return 0.01

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
                    if str(comment.get("severity", "")).lower() == str(
                        truth.get("severity", "")
                    ).lower():
                        severity_correct += 1
                    break

        coverage = len(matched_gt) / len(ground_truth)
        precision = true_positives / len(comments) if comments else 1.0
        severity_accuracy = severity_correct / len(comments) if comments else 1.0

        score = 0.5 * coverage + 0.3 * precision + 0.2 * severity_accuracy
        score = self.apply_anti_spam(score, comments, ground_truth)
        return float(min(max(score, 0.01), 0.99))

    def is_success(
        self,
        task_type: str,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        final_score: float,
    ) -> bool:
        if not ground_truth:
            return False

        matched_count = self.count_matched_ground_truth(comments, ground_truth, task_type)
        precision = self.compute_precision(comments, ground_truth, task_type)

        if task_type == "easy":
            return matched_count == len(ground_truth)
        if task_type == "medium":
            return matched_count == len(ground_truth) and precision >= 0.5 and final_score >= 0.65
        return matched_count == len(ground_truth) and precision >= 0.6 and final_score >= 0.75

    def score_hard_with_llm_judge(
        self,
        comments: list[dict[str, Any]],
        ground_truth: list[dict[str, Any]],
        diff: str,
        api_base_url: str,
        api_key: str | None,
        model_name: str,
    ) -> float:
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
            match = re.search(r"-?\d+(?:\.\d+)?", raw)
            if match is None:
                return rule_score

            llm_score = float(match.group(0))
            llm_score = float(min(max(llm_score, 0.01), 0.99))
            final = 0.6 * rule_score + 0.4 * llm_score
            return float(min(max(final, 0.01), 0.99))
        except Exception:
            return rule_score


    def get_explanation(self, reward: float, is_match: bool, sev_match: bool, cat_match: bool) -> str:
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

grader = Grader()

assert grader.score_easy([], [{"line": 1, "severity": "high", "category": "logic"}]) == 0.01
assert grader.compute_reward(0.0, 0.5) == 0.35
