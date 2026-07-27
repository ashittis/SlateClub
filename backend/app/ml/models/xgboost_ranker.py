"""
XGBoost Ranking Model (ARCHITECTURE.md Section 1.5, Stage 3)

Trained on: did user watch? did they rate ≥ 4? did they review?
Features: [user_taste_sim, cf_score, content_score, two_tower_score,
           trending_score, popularity, recency, genre_overlap_count]
"""

import os

import numpy as np

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

# Trained model artifact — gitignored, loaded on init only if it exists (so a
# harness-gated training run can drop it in and the pipeline picks it up, and
# nothing ships until the harness says it beats the fallback).
_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
DEFAULT_ARTIFACT = os.path.join(_ARTIFACT_DIR, "xgboost_ranker.json")


class XGBoostRanker:
    """XGBoost-based ranking model for Stage 3 of the pipeline."""

    def __init__(self, *, auto_load: bool = True):
        self.model = None
        self.trained = False
        self.feature_names = [
            "taste_similarity",
            "cf_score",
            "content_score",
            "two_tower_score",
            "trending_score",
            "popularity",
            "recency",
            "genre_overlap",
            "language_match",
            "mood_alignment",
            "semantic_similarity",
            "completion_pct_avg",
        ]
        # Pick up a shipped artifact if one exists; otherwise stay on the
        # fallback weighted sum. Training writes the artifact ONLY after the
        # eval harness confirms it beats the fallback.
        if auto_load and HAS_XGBOOST and os.path.exists(DEFAULT_ARTIFACT):
            try:
                self.load(DEFAULT_ARTIFACT)
            except Exception as exc:  # noqa: BLE001
                print(f"[xgboost] artifact load failed, using fallback: {exc}")

    def train(self, features: np.ndarray, labels: np.ndarray) -> bool:
        """Train the ranker on historical outcomes. Returns True if a model was
        fit (≥50 rows and xgboost present), False if it declined (caller keeps
        the fallback). Does NOT persist — the caller saves only if the harness
        proves the model beats the fallback.

        features: (N, 12) array; labels: (N,) binary engagement."""
        if not HAS_XGBOOST or len(features) < 50:
            return False

        dtrain = xgb.DMatrix(features, label=labels, feature_names=self.feature_names)
        params = {
            "objective": "binary:logistic",
            "max_depth": 4,
            "eta": 0.1,
            "eval_metric": "auc",
            "nthread": 2,
        }
        self.model = xgb.train(params, dtrain, num_boost_round=100)
        self.trained = True
        return True

    def save(self, path: str = DEFAULT_ARTIFACT) -> None:
        if self.model is None:
            raise RuntimeError("nothing to save — model is not trained")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.model.save_model(path)

    def load(self, path: str = DEFAULT_ARTIFACT) -> None:
        booster = xgb.Booster()
        booster.load_model(path)
        self.model = booster
        self.trained = True

    def rank(self, features: np.ndarray) -> np.ndarray:
        """Score candidates. Returns array of predicted engagement probabilities."""
        if not self.trained or self.model is None:
            # Fallback: weighted sum. Weights sum to 1.0.
            # two_tower weight is 0 — the model is an untrained random
            # projection (Phase 5 PyTorch training pending), so any
            # nonzero weight injects correlated noise into rankings.
            # semantic_similarity gets 0.20 because the OpenAI-embedded
            # taste statement vs MovieIdentity match is the strongest
            # signal we have at low data; reclaimed from popularity
            # and recency where appropriate.
            # Order:
            #   taste_sim, cf, content, two_tower, trending, popularity,
            #   recency, genre_overlap, language_match, mood_alignment,
            #   semantic_similarity
            weights = np.array(
                # taste, cf, content, two_tower, trending, pop, recency,
                # genre_overlap, lang_match, mood, semantic, completion
                [0.17, 0.10, 0.15, 0.00, 0.05, 0.05, 0.05, 0.05, 0.10, 0.05, 0.20, 0.03],
                dtype=np.float32,
            )
            n_feat = features.shape[1]
            if n_feat != len(weights):
                # Degrade gracefully if a caller passes the legacy 8-feature shape.
                weights = weights[:n_feat]
                weights = weights / weights.sum()
            return features @ weights

        dtest = xgb.DMatrix(features, feature_names=self.feature_names)
        return self.model.predict(dtest)
