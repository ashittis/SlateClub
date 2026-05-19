"""
Contextual Bandit for Source Blending (ARCHITECTURE.md Section 1.6)

Each recommendation source (CF, content, graph, trending) is a bandit arm.
The bandit adjusts blend weights per user segment.

Reward = 0.4 × CTR + 0.4 × watch_through_rate + 0.2 × post_watch_rating
"""

import json
import os
import random
from dataclasses import dataclass, field

_STATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bandit_state.json")


@dataclass
class ArmStats:
    """Stats for a single bandit arm (recommendation source)."""
    pulls: int = 0
    total_reward: float = 0.0

    @property
    def mean_reward(self) -> float:
        return self.total_reward / self.pulls if self.pulls > 0 else 0.5  # optimistic initial


# User segment definitions
SEGMENTS = {
    "heavy_rater": {"content": 0.35, "cf": 0.25, "graph": 0.20, "trending": 0.10, "serendipity": 0.10},
    "new_user": {"content": 0.15, "cf": 0.10, "graph": 0.10, "trending": 0.35, "serendipity": 0.30},
    "social_user": {"content": 0.15, "cf": 0.15, "graph": 0.40, "trending": 0.15, "serendipity": 0.15},
    "discovery_seeker": {"content": 0.10, "cf": 0.10, "graph": 0.20, "trending": 0.10, "serendipity": 0.50},
    "default": {"content": 0.25, "cf": 0.25, "graph": 0.20, "trending": 0.15, "serendipity": 0.15},
}


class ContextualBandit:
    """Epsilon-greedy contextual bandit for recommendation source blending."""

    def __init__(self, epsilon: float = 0.1):
        self.epsilon = epsilon
        # Per-segment arm stats
        self.arms: dict[str, dict[str, ArmStats]] = {}
        self._load_state()

    def _load_state(self) -> None:
        try:
            if os.path.exists(_STATE_PATH):
                with open(_STATE_PATH) as f:
                    data = json.load(f)
                for segment, sources in data.items():
                    self.arms[segment] = {}
                    for source, stats in sources.items():
                        self.arms[segment][source] = ArmStats(
                            pulls=stats.get("pulls", 0),
                            total_reward=stats.get("total_reward", 0.0),
                        )
        except Exception:
            pass

    def _save_state(self) -> None:
        try:
            data = {
                segment: {
                    source: {"pulls": arm.pulls, "total_reward": arm.total_reward}
                    for source, arm in sources.items()
                }
                for segment, sources in self.arms.items()
            }
            with open(_STATE_PATH, "w") as f:
                json.dump(data, f)
        except Exception:
            pass

    def classify_user(
        self,
        rating_count: int,
        follow_count: int,
        days_since_signup: int,
    ) -> str:
        """Classify user into a segment."""
        if days_since_signup < 7 or rating_count < 5:
            return "new_user"
        if rating_count > 50:
            return "heavy_rater"
        if follow_count > 10:
            return "social_user"
        return "default"

    def get_blend_weights(self, segment: str) -> dict[str, float]:
        """Get source blend weights for a segment, with exploration."""
        base_weights = SEGMENTS.get(segment, SEGMENTS["default"]).copy()

        # Get learned stats for this segment
        segment_arms = self.arms.get(segment, {})

        if segment_arms and random.random() > self.epsilon:
            # Exploit: adjust weights based on learned rewards
            total_reward = sum(a.mean_reward for a in segment_arms.values())
            if total_reward > 0:
                for source in base_weights:
                    if source in segment_arms:
                        learned = segment_arms[source].mean_reward / total_reward
                        # Blend 50% base + 50% learned
                        base_weights[source] = 0.5 * base_weights[source] + 0.5 * learned

        # Normalize
        total = sum(base_weights.values())
        if total > 0:
            base_weights = {k: v / total for k, v in base_weights.items()}

        return base_weights

    def record_reward(
        self,
        segment: str,
        source: str,
        clicked: bool,
        watch_through: float,
        rating: float | None,
    ):
        """Record outcome for a recommendation. Updates bandit arm stats."""
        reward = (
            0.4 * (1.0 if clicked else 0.0)
            + 0.4 * watch_through
            + 0.2 * ((rating / 5.0) if rating else 0.0)
        )

        if segment not in self.arms:
            self.arms[segment] = {}
        if source not in self.arms[segment]:
            self.arms[segment][source] = ArmStats()

        self.arms[segment][source].pulls += 1
        self.arms[segment][source].total_reward += reward
        self._save_state()

    def get_stats(self, segment: str) -> dict:
        """Get current arm stats for a segment."""
        segment_arms = self.arms.get(segment, {})
        return {
            source: {"pulls": arm.pulls, "mean_reward": round(arm.mean_reward, 3)}
            for source, arm in segment_arms.items()
        }


# Global bandit instance
bandit = ContextualBandit()
