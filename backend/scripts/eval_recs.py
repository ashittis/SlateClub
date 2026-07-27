"""Offline recommendation eval — baseline (served order) vs a candidate scorer.

Run from backend/:

    python -m scripts.eval_recs                 # current ranker as candidate
    python -m scripts.eval_recs --min-impressions 200 --min-conversions 20

With no trained artifact this scores the fallback against the served order (a
plumbing sanity check). On low-volume dev data it prints the INSUFFICIENT DATA
banner and renders no verdict — that's the designed behaviour, not a failure.
"""

from __future__ import annotations

import argparse
import asyncio

import numpy as np
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.ml.eval.harness import evaluate, load_slates
from app.ml.eval.feature_reconstruction import FEATURE_NAMES
from app.ml.models.xgboost_ranker import XGBoostRanker

# Import every model module so SQLAlchemy resolves string relationships.
from app import models_registry  # noqa: F401


def _synthetic_precision_check() -> None:
    """Tiny unit check of the precision@k math — a converted item ranked into
    the top-k must count. Two 10-item slates, one converted item each; a scorer
    that ranks the converted item first should score 1/10 per slate."""
    from app.ml.eval.harness import Slate, SlateItem, _precision_at_k

    slates = []
    for s in range(2):
        items = [
            SlateItem(movie_id=f"m{s}{i}", user_id="u", position=i, converted=(i == 7), features=[float(i)])
            for i in range(10)
        ]
        slates.append(Slate(session_id=f"s{s}", items=items))
    # Score = feature value; converted item (i=7) is NOT first → not in a naive top-1
    # but IS in top-10, so precision@10 = 1/10.
    p = _precision_at_k(slates, 10, order=lambda it: it.features[0])
    assert abs(p - 0.1) < 1e-9, p
    # Baseline by served position → converted at position 7 still in top-10.
    pb = _precision_at_k(slates, 10, order=lambda it: -it.position)
    assert abs(pb - 0.1) < 1e-9, pb
    print("[eval] precision@k self-check OK")


async def run(*, min_impressions: int, min_conversions: int) -> None:
    _synthetic_precision_check()

    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    ranker = XGBoostRanker()  # fallback unless an artifact is present
    print(f"[eval] ranker trained={ranker.trained}  features={len(FEATURE_NAMES)}")

    def score_fn(feats: list[float]) -> float:
        return float(ranker.rank(np.array([feats], dtype=np.float32))[0])

    async with Session() as session:
        slates, reconstructed = await load_slates(session)
        report = evaluate(
            slates, score_fn,
            reconstructed=reconstructed,
            min_impressions=min_impressions,
            min_conversions=min_conversions,
        )
        print(report.render())

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--min-impressions", type=int, default=1000)
    parser.add_argument("--min-conversions", type=int, default=100)
    args = parser.parse_args()
    asyncio.run(run(min_impressions=args.min_impressions, min_conversions=args.min_conversions))


if __name__ == "__main__":
    main()
