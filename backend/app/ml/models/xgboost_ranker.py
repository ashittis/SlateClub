"""
XGBoost Ranking Model (ARCHITECTURE.md Section 1.5, Stage 3)

Trained on: did user watch? did they rate ≥ 4? did they review?
Features: [user_taste_sim, cf_score, content_score, two_tower_score,
           trending_score, popularity, recency, genre_overlap_count]
"""

import numpy as np

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False


class XGBoostRanker:
    """XGBoost-based ranking model for Stage 3 of the pipeline."""

    def __init__(self):
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

    def train(self, features: np.ndarray, labels: np.ndarray):
        """Train ranking model on historical interaction outcomes.

        features: (N, 8) array of feature vectors
        labels: (N,) binary — 1 if user engaged (watched + rated ≥ 4), 0 otherwise
        """
        if not HAS_XGBOOST or len(features) < 50:
            return

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

    def rank(self, features: np.ndarray) -> np.ndarray:
        """Score candidates. Returns array of predicted engagement probabilities."""
        if not self.trained or self.model is None:
            # Fallback: weighted sum. Weights sum to 1.0.
            # two_tower weight is 0 — the model is an untrained random
            # projection (Phase 5 PyTorch training pending), so any
            # nonzero weight injects correlated noise into rankings.
            # semantic_similarity gets 0.20 because the Gemini-embedded
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
