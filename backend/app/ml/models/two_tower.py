"""
Two-Tower Neural Retrieval (Layer 3 of ARCHITECTURE.md Section 1.3)

Phase 3 stub: Uses a simple feed-forward similarity model with numpy.
Full PyTorch training pipeline comes in Phase 5.

Architecture:
  User Tower:  [interaction_history_embeddings] → dense → 64-dim user_embedding
  Movie Tower: [movie_embedding] → dense → 64-dim movie_embedding
"""

import numpy as np

from ..embeddings.taste_vector import VECTOR_DIM


class TwoTowerModel:
    """Simplified two-tower model using random projections as a Phase 3 placeholder.

    In production (Phase 5), this is replaced with a PyTorch model trained on
    positive/negative interaction pairs using in-batch softmax loss.
    """

    def __init__(self, embed_dim: int = 64):
        self.embed_dim = embed_dim
        self.trained = False

        # Random projection matrices (placeholder for learned weights)
        np.random.seed(123)
        self.user_projection = np.random.randn(VECTOR_DIM, embed_dim).astype(np.float32) * 0.1
        self.movie_projection = np.random.randn(VECTOR_DIM, embed_dim).astype(np.float32) * 0.1

    def encode_user(self, taste_vector: np.ndarray) -> np.ndarray:
        """Project user taste vector into shared embedding space."""
        emb = taste_vector @ self.user_projection
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 0 else emb

    def encode_movie(self, movie_embedding: np.ndarray) -> np.ndarray:
        """Project movie embedding into shared embedding space."""
        emb = movie_embedding @ self.movie_projection
        norm = np.linalg.norm(emb)
        return emb / norm if norm > 0 else emb

    def score(self, user_emb: np.ndarray, movie_emb: np.ndarray) -> float:
        """Dot product score between user and movie in shared space."""
        return float(np.dot(user_emb, movie_emb))

    def recommend(
        self,
        user_taste_vector: np.ndarray,
        movie_embeddings: dict[str, np.ndarray],
        n: int = 300,
    ) -> list[tuple[str, float]]:
        """ANN-style retrieval (brute force for Phase 3 scale)."""
        user_emb = self.encode_user(user_taste_vector)

        scores = []
        for mid, m_raw in movie_embeddings.items():
            m_emb = self.encode_movie(m_raw)
            s = self.score(user_emb, m_emb)
            scores.append((mid, s))

        scores.sort(key=lambda x: -x[1])
        return scores[:n]
