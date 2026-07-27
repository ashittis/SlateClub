"""
ALS Collaborative Filtering (Layer 1 of ARCHITECTURE.md Section 1.3)

Alternating Least Squares on implicit feedback matrix.
Uses scipy sparse matrices + manual ALS implementation since `implicit` library
failed to build on this platform.
"""

import os
import pickle

import numpy as np
from scipy import sparse

_ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
DEFAULT_ARTIFACT = os.path.join(_ARTIFACT_DIR, "als_model.pkl")


class ALSModel:
    """Simple ALS for implicit feedback collaborative filtering."""

    def __init__(self, factors: int = 64, regularization: float = 0.1, iterations: int = 15, *, auto_load: bool = True):
        self.factors = factors
        self.regularization = regularization
        self.iterations = iterations
        self.user_factors: np.ndarray | None = None
        self.item_factors: np.ndarray | None = None
        self.user_ids: list[str] = []
        self.item_ids: list[str] = []
        self._user_index: dict[str, int] = {}
        self._item_index: dict[str, int] = {}
        # Load a shipped artifact if present; else recommend() returns [] and CF
        # reaches the feed only via the graph blend. Training writes the artifact
        # only after the harness confirms it beats that fallback.
        if auto_load and os.path.exists(DEFAULT_ARTIFACT):
            try:
                self.load(DEFAULT_ARTIFACT)
            except Exception as exc:  # noqa: BLE001
                print(f"[als] artifact load failed, staying empty: {exc}")

    def save(self, path: str = DEFAULT_ARTIFACT) -> None:
        if self.user_factors is None or self.item_factors is None:
            raise RuntimeError("nothing to save — model is not fit")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "user_factors": self.user_factors,
                "item_factors": self.item_factors,
                "user_ids": self.user_ids,
                "item_ids": self.item_ids,
                "_user_index": self._user_index,
                "_item_index": self._item_index,
                "factors": self.factors,
            }, f)

    def load(self, path: str = DEFAULT_ARTIFACT) -> None:
        with open(path, "rb") as f:
            state = pickle.load(f)
        self.user_factors = state["user_factors"]
        self.item_factors = state["item_factors"]
        self.user_ids = state["user_ids"]
        self.item_ids = state["item_ids"]
        self._user_index = state["_user_index"]
        self._item_index = state["_item_index"]
        self.factors = state.get("factors", self.factors)

    def fit(self, interactions: list[dict]):
        """
        Train ALS model from interaction data.

        Each interaction: { user_id, movie_id, weight }
        weight: signal strength (e.g. rating/5.0, watched=0.6, etc.)
        """
        if len(interactions) < 10:
            return  # Not enough data

        # Build user/item index
        users = sorted(set(i["user_id"] for i in interactions))
        items = sorted(set(i["movie_id"] for i in interactions))
        self.user_ids = users
        self.item_ids = items
        self._user_index = {uid: idx for idx, uid in enumerate(users)}
        self._item_index = {iid: idx for idx, iid in enumerate(items)}

        n_users = len(users)
        n_items = len(items)

        # Build sparse interaction matrix
        rows, cols, vals = [], [], []
        for i in interactions:
            u = self._user_index.get(i["user_id"])
            m = self._item_index.get(i["movie_id"])
            if u is not None and m is not None:
                rows.append(u)
                cols.append(m)
                vals.append(i["weight"])

        R = sparse.csr_matrix((vals, (rows, cols)), shape=(n_users, n_items))

        # Initialize factors randomly
        np.random.seed(42)
        self.user_factors = np.random.normal(0, 0.01, (n_users, self.factors)).astype(np.float32)
        self.item_factors = np.random.normal(0, 0.01, (n_items, self.factors)).astype(np.float32)

        # ALS iterations
        reg_eye = self.regularization * np.eye(self.factors)
        for _ in range(self.iterations):
            # Fix items, solve for users
            YtY = self.item_factors.T @ self.item_factors + reg_eye
            for u in range(n_users):
                row = R[u].toarray().flatten()
                nz = row.nonzero()[0]
                if len(nz) == 0:
                    continue
                Y_u = self.item_factors[nz]
                r_u = row[nz]
                self.user_factors[u] = np.linalg.solve(
                    Y_u.T @ Y_u + reg_eye, Y_u.T @ r_u
                )

            # Fix users, solve for items
            XtX = self.user_factors.T @ self.user_factors + reg_eye
            for i in range(n_items):
                col = R[:, i].toarray().flatten()
                nz = col.nonzero()[0]
                if len(nz) == 0:
                    continue
                X_i = self.user_factors[nz]
                r_i = col[nz]
                self.item_factors[i] = np.linalg.solve(
                    X_i.T @ X_i + reg_eye, X_i.T @ r_i
                )

    def recommend(self, user_id: str, n: int = 200) -> list[tuple[str, float]]:
        """Get top-N item recommendations for a user. Returns [(movie_id, score)]."""
        if self.user_factors is None or user_id not in self._user_index:
            return []

        u_idx = self._user_index[user_id]
        scores = self.item_factors @ self.user_factors[u_idx]

        top_indices = np.argsort(-scores)[:n]
        return [(self.item_ids[i], float(scores[i])) for i in top_indices]

    def similar_items(self, movie_id: str, n: int = 20) -> list[tuple[str, float]]:
        """Find similar items by factor dot product."""
        if self.item_factors is None or movie_id not in self._item_index:
            return []

        m_idx = self._item_index[movie_id]
        target = self.item_factors[m_idx]
        scores = self.item_factors @ target
        scores[m_idx] = -1  # exclude self

        top_indices = np.argsort(-scores)[:n]
        return [(self.item_ids[i], float(scores[i])) for i in top_indices]
