"""Train the Stage-3 XGBoost ranker on logged impressions + real outcomes,
and SHIP IT ONLY IF the eval harness proves it beats the fallback.

Run from backend/:

    python -m scripts.train_xgboost
    python -m scripts.train_xgboost --min-impressions 200 --min-conversions 20

Positives = impressions whose (user, movie) converted (watched / rated ≥4 /
reviewed after the impression); negatives = shown-not-converted. Features come
from features_json when captured, else point-in-time reconstruction — the same
loader the harness uses. If under the 50-row floor, or the harness says the
model doesn't win, NO artifact is written and the pipeline stays on the fallback.
"""

from __future__ import annotations

import argparse
import asyncio

import numpy as np
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.ml.eval.harness import evaluate, load_slates
from app.ml.models.xgboost_ranker import XGBoostRanker

from app import models_registry  # noqa: F401


async def run(*, min_impressions: int, min_conversions: int) -> None:
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        slates, reconstructed = await load_slates(session)

        rows = [it for s in slates for it in s.items]
        features = np.array([it.features for it in rows], dtype=np.float32)
        labels = np.array([1.0 if it.converted else 0.0 for it in rows], dtype=np.float32)
        n_pos = int(labels.sum())
        print(f"[train] {len(rows)} rows  positives={n_pos}  reconstructed={reconstructed}")

        if len(rows) < 50:
            print("[train] under the 50-row floor — declining to train. No artifact.")
            await engine.dispose()
            return
        if n_pos == 0 or n_pos == len(rows):
            print("[train] single-class labels — cannot train a discriminator. No artifact.")
            await engine.dispose()
            return

        candidate = XGBoostRanker(auto_load=False)
        if not candidate.train(features, labels):
            print("[train] ranker declined to fit. No artifact.")
            await engine.dispose()
            return

        # Shadow eval: trained candidate vs the served (fallback) order.
        def score_fn(feats: list[float]) -> float:
            return float(candidate.rank(np.array([feats], dtype=np.float32))[0])

        report = evaluate(
            slates, score_fn,
            reconstructed=reconstructed,
            min_impressions=min_impressions,
            min_conversions=min_conversions,
        )
        print(report.render())

        if report.candidate_wins:
            candidate.save()
            print(f"\n[train] ✓ trained model beats fallback — artifact written to {candidate.__class__.__name__} default path.")
        else:
            print("\n[train] ✗ trained model does not beat the fallback (or insufficient data). "
                  "No artifact written; pipeline stays on the fallback.")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-impressions", type=int, default=1000)
    parser.add_argument("--min-conversions", type=int, default=100)
    args = parser.parse_args()
    asyncio.run(run(min_impressions=args.min_impressions, min_conversions=args.min_conversions))


if __name__ == "__main__":
    main()
