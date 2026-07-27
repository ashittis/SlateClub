"""ALS readiness check, then train + harness-gate.

Run from backend/:

    python -m scripts.train_als                       # readiness → maybe train
    python -m scripts.train_als --min-users-cleared 3

Collaborative filtering only helps once enough users share enough films. This
FIRST reports how many active users clear the 10-interaction floor and the
resulting matrix density; if too sparse it recommends deferral and does NOT
train. If adequate it fits ALS, then the eval harness checks whether ALS in the
cf_score slot beats the current graph blend — shipping an artifact only if it wins.
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.ml.eval.harness import evaluate, load_slates
from app.ml.models.als import ALSModel
from app.ml.models.xgboost_ranker import XGBoostRanker
from app.shared.models.actions import Rating, WatchHistory

from app import models_registry  # noqa: F401

_MIN_INTERACTIONS = 10  # ALS.fit's per-model floor; we want users clearing this


async def _interactions(session) -> list[dict]:
    out: list[dict] = []
    for r in (await session.execute(select(Rating))).scalars().all():
        out.append({"user_id": r.user_id, "movie_id": r.movie_id, "weight": (r.value or 0) / 5.0})
    for w in (await session.execute(select(WatchHistory))).scalars().all():
        pct = w.completion_pct or 0.0
        weight = 0.6 if pct >= 90 else 0.4 if pct >= 70 else 0.0
        if weight:
            out.append({"user_id": w.user_id, "movie_id": w.movie_id, "weight": weight})
    return out


async def run(*, min_users_cleared: int, min_impressions: int, min_conversions: int) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        interactions = await _interactions(session)

        # ── Readiness ──
        per_user = Counter(i["user_id"] for i in interactions)
        users = list(per_user)
        items = {i["movie_id"] for i in interactions}
        cleared = [u for u, c in per_user.items() if c >= _MIN_INTERACTIONS]
        n_users, n_items, nnz = len(users), len(items), len(interactions)
        density = nnz / (n_users * n_items) if (n_users and n_items) else 0.0
        pct_cleared = 100 * len(cleared) / n_users if n_users else 0.0

        print("── ALS readiness ────────────────────────────────────")
        print(f"active users={n_users}  items={n_items}  interactions={nnz}")
        print(f"users clearing {_MIN_INTERACTIONS} interactions: {len(cleared)} ({pct_cleared:.0f}%)")
        print(f"matrix density (nnz / users×items): {density:.4f}")

        if len(cleared) < min_users_cleared or nnz < _MIN_INTERACTIONS:
            print(f"\n[als] too sparse (need ≥{min_users_cleared} users clearing "
                  f"{_MIN_INTERACTIONS}). Recommend deferral — NOT training.")
            await engine.dispose()
            return

        # ── Train ──
        als = ALSModel(factors=64, auto_load=False)
        als.fit(interactions)
        if als.user_factors is None:
            print("[als] fit produced no factors. No artifact.")
            await engine.dispose()
            return

        def als_score(user_id: str, movie_id: str) -> float:
            u = als._user_index.get(user_id)
            m = als._item_index.get(movie_id)
            if u is None or m is None:
                return 0.0
            return float(als.item_factors[m] @ als.user_factors[u])

        # ── Harness: trained ALS in the cf_score slot vs the served order ──
        ranker = XGBoostRanker(auto_load=False)  # fallback weighted sum
        slates, reconstructed = await load_slates(session)

        def item_score_fn(item) -> float:
            feats = list(item.features)
            feats[1] = als_score(item.user_id, item.movie_id)  # cf_score is index 1
            return float(ranker.rank(np.array([feats], dtype=np.float32))[0])

        report = evaluate(
            slates, item_score_fn=item_score_fn,
            reconstructed=reconstructed,
            min_impressions=min_impressions, min_conversions=min_conversions,
        )
        print()
        print(report.render())

        if report.candidate_wins:
            als.save()
            print("\n[als] ✓ trained ALS beats the graph-blend fallback — artifact written.")
        else:
            print("\n[als] ✗ trained ALS does not beat the fallback (or insufficient data). "
                  "No artifact written.")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-users-cleared", type=int, default=5)
    parser.add_argument("--min-impressions", type=int, default=1000)
    parser.add_argument("--min-conversions", type=int, default=100)
    args = parser.parse_args()
    asyncio.run(run(
        min_users_cleared=args.min_users_cleared,
        min_impressions=args.min_impressions,
        min_conversions=args.min_conversions,
    ))


if __name__ == "__main__":
    main()
