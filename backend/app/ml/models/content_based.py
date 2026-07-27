"""
Content-Based Filtering (Layer 2 of ARCHITECTURE.md Section 1.3)

score(user, movie) = cosine_similarity(user_taste_vector, movie_embedding)
"""

import numpy as np

from app.ml.embeddings.taste_vector import movie_to_embedding, cosine_similarity


class ContentBasedModel:
    """Content-based recommender using taste vector similarity."""

    def __init__(self):
        self.movie_embeddings: dict[str, np.ndarray] = {}
        self.movie_data_map: dict[str, dict] = {}

    def index_movies(self, movies: list[dict]):
        """Index movie embeddings for fast lookup.
        Each movie dict needs: id, genres, vote_average, popularity, runtime, release_date, original_language
        """
        for m in movies:
            mid = m["id"]
            emb = movie_to_embedding(m)
            self.movie_embeddings[mid] = emb
            self.movie_data_map[mid] = m

    def recommend(
        self,
        user_taste_vector: np.ndarray,
        n: int = 200,
        exclude_ids: set[str] | None = None,
    ) -> list[tuple[str, float]]:
        """Score all indexed movies against user taste vector. Returns [(movie_id, score)]."""
        exclude = exclude_ids or set()
        scores = []

        for mid, emb in self.movie_embeddings.items():
            if mid in exclude:
                continue
            score = cosine_similarity(user_taste_vector, emb)
            scores.append((mid, score))

        scores.sort(key=lambda x: -x[1])
        return scores[:n]
