import pytest
import sys
import os

# Add the server directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "code-review-env")))

from server.grader import Grader

@pytest.fixture
def grader():
    return Grader()

def test_match_tolerance(grader):
    assert grader.get_match_tolerance("easy") == 3
    assert grader.get_match_tolerance("medium") == 2
    assert grader.get_match_tolerance("hard") == 0

def test_comment_matches_ground_truth(grader):
    # Easy: Tolerance 3
    gt = {"line": 10}
    assert grader.comment_matches_ground_truth({"line": 10}, gt, "easy") is True
    assert grader.comment_matches_ground_truth({"line": 13}, gt, "easy") is True
    assert grader.comment_matches_ground_truth({"line": 14}, gt, "easy") is False
    
    # Hard: Tolerance 0
    assert grader.comment_matches_ground_truth({"line": 10}, gt, "hard") is True
    assert grader.comment_matches_ground_truth({"line": 11}, gt, "hard") is False

def test_score_easy_perfect_match(grader):
    gt = [{"line": 5, "severity": "high", "category": "logic"}]
    comments = [{"line": 5, "severity": "high", "category": "logic"}]
    score = grader.score_easy(comments, gt)
    # Expected: Line match (0.25) + Severity match (0.10) = 0.35 -> Clamped to 0.99 if it logic allows, 
    # but score_easy starts at 0.0 and adds points.
    # Note: score_easy in grader.py doesn't have a high base, so 0.35 is expected.
    assert score == 0.35

def test_score_easy_missing_bug(grader):
    gt = [{"line": 5, "severity": "high"}]
    comments = []
    assert grader.score_easy(comments, gt) == 0.01

def test_anti_spam_penalty(grader):
    gt = [{"line": 5}]
    # 3 comments on the same line (penalty triggers for > 2)
    comments = [
        {"line": 5},
        {"line": 5},
        {"line": 5}
    ]
    raw_score = 0.5
    # score -= 0.15 * (3 - 2) = 0.35
    assert grader.apply_anti_spam(raw_score, comments, gt) == 0.35

def test_compute_reward(grader):
    # Clamped [0.01, 0.35]
    assert grader.compute_reward(0.1, 0.5) == 0.35
    assert grader.compute_reward(0.1, 0.105) == 0.01 # Below min reward
    assert grader.compute_reward(0.5, 0.4) == 0.01 # Negative delta
