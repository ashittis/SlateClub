"""Offline evaluation harness for the ranker.

Compares a candidate scoring function against the order actually served, using
logged impressions joined to real outcomes. This is the gate every trained model
must pass before it ships (Tasks 2/3): if the candidate doesn't beat the fallback
on real data, no artifact is written.

Not on the request path. Importable (Tasks 2/3 reuse `evaluate`) and driven by
scripts/eval_recs.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.models.actions import DiaryEntry, Rating, Review, WatchHistory
from app.shared.models.movie import Movie
from app.shared.models.social import Impression
from app.ml.embeddings.taste_vector import compute_user_taste_vector, rating_signal
from app.ml.eval.feature_reconstruction import build_feature_row, user_genre_set

# Below these, the comparison is not statistically meaningful — we refuse a verdict.
DEFAULT_MIN_IMPRESSIONS = 1000
DEFAULT_MIN_CONVERSIONS = 100

ScoreFn = Callable[[list[float]], float]


@dataclass
class SlateItem:
    movie_id: str
    user_id: str
    position: int
    converted: bool
    features: list[float]


@dataclass
class Slate:
    session_id: str
    items: list[SlateItem]


@dataclass
class Report:
    slates: int
    impressions: int
    conversions: int
    baseline_precision_at_k: float
    candidate_precision_at_k: float
    take_rate: float
    k: int
    sufficient: bool
    reconstructed: int  # impressions whose features were reconstructed (no features_json)

    @property
    def candidate_wins(self) -> bool:
        # take_rate is ordering-invariant (same slates), so precision@k is the
        # discriminator; the gate stays conservative (strictly greater).
        return self.sufficient and self.candidate_precision_at_k > self.baseline_precision_at_k

    def render(self) -> str:
        lines = [
            "── Recommendation eval ──────────────────────────────",
            f"slates={self.slates}  impressions={self.impressions}  "
            f"conversions={self.conversions}  reconstructed={self.reconstructed}",
            f"take_rate={self.take_rate:.4f}",
            f"precision@{self.k}:  baseline={self.baseline_precision_at_k:.4f}  "
            f"candidate={self.candidate_precision_at_k:.4f}",
        ]
        if not self.sufficient:
            lines += [
                "",
                "⚠  INSUFFICIENT DATA — comparison not statistically meaningful.",
                f"   Need ≥{DEFAULT_MIN_IMPRESSIONS} impressions and "
                f"≥{DEFAULT_MIN_CONVERSIONS} conversions. No verdict rendered.",
            ]
        else:
            verdict = "CANDIDATE WINS" if self.candidate_wins else "candidate does NOT beat baseline"
            lines += ["", f"→ {verdict}"]
        return "\n".join(lines)


# ── Outcome attribution ──────────────────────────────────────────

async def _outcome_rows(db: AsyncSession, cutoff: datetime) -> dict[str, list]:
    """Raw positive-outcome rows after `cutoff`, per source. Converted = watched
    (WatchHistory or a per-viewing DiaryEntry) OR rated ≥ 4 OR reviewed. We
    over-collect (everything after the earliest impression) and filter per
    impression by shown_at when scoring."""
    wh = (await db.execute(
        select(WatchHistory.user_id, WatchHistory.movie_id, WatchHistory.watched_at)
        .where(WatchHistory.watched_at > cutoff)
    )).all()
    de = (await db.execute(
        select(DiaryEntry.user_id, DiaryEntry.movie_id, DiaryEntry.created_at)
        .where(DiaryEntry.created_at > cutoff)
    )).all()
    ra = (await db.execute(
        select(Rating.user_id, Rating.movie_id, Rating.created_at)
        .where(Rating.value >= 4.0, Rating.created_at > cutoff)
    )).all()
    rv = (await db.execute(
        select(Review.user_id, Review.movie_id, Review.created_at)
        .where(Review.created_at > cutoff)
    )).all()
    return {"watched": wh, "diary": de, "rated": ra, "reviewed": rv}


# ── Slate assembly ───────────────────────────────────────────────

async def load_slates(db: AsyncSession) -> tuple[list[Slate], int]:
    """Build eval slates from logged impressions. Returns (slates, reconstructed_count).

    Prefers each impression's captured features_json; falls back to point-in-time
    reconstruction (taste vector rebuilt from only interactions before the
    impression). One caveat, documented: semantic_similarity can't be
    reconstructed historically (no per-time taste embedding stored) and comes
    through as its captured value or 0."""
    impressions = (await db.execute(select(Impression))).scalars().all()
    if not impressions:
        return [], 0

    earliest = min(i.shown_at for i in impressions)
    outcome_rows = await _outcome_rows(db, earliest)

    # Flatten outcomes into (user, movie) -> earliest outcome time.
    outcome_time: dict[tuple[str, str], datetime] = {}
    for rows in outcome_rows.values():
        for uid, mid, ts in rows:
            key = (uid, mid)
            if ts and (key not in outcome_time or ts < outcome_time[key]):
                outcome_time[key] = ts

    movies = {m.id: m for m in (await db.execute(select(Movie))).scalars().all()}

    # Per-user interaction timelines, for reconstructing historical taste vectors.
    timelines = await _user_timelines(db, movies)

    reconstructed = 0
    slates_map: dict[str, list[SlateItem]] = {}
    for imp in impressions:
        key = (imp.user_id, imp.movie_id)
        ot = outcome_time.get(key)
        converted = ot is not None and ot > imp.shown_at

        feats = imp.features_json
        if not feats:
            feats = _reconstruct(imp, movies, timelines.get(imp.user_id, []))
            if feats is None:
                continue
            reconstructed += 1

        sid = imp.session_id or imp.id
        slates_map.setdefault(sid, []).append(
            SlateItem(
                movie_id=imp.movie_id, user_id=imp.user_id, position=imp.position,
                converted=converted, features=list(feats),
            )
        )

    slates = [Slate(session_id=sid, items=items) for sid, items in slates_map.items()]
    return slates, reconstructed


async def _user_timelines(db: AsyncSession, movies: dict) -> dict[str, list[dict]]:
    """Per-user interaction list {movie_data, signal_type, created_at} for taste
    reconstruction. Ratings + watch history only (the strongest, timestamped
    signals); enough to rebuild the taste vector as of any impression."""
    timelines: dict[str, list[dict]] = {}

    ratings = (await db.execute(select(Rating))).scalars().all()
    for r in ratings:
        m = movies.get(r.movie_id)
        if not m:
            continue
        timelines.setdefault(r.user_id, []).append({
            "movie_data": _movie_data(m),
            "signal_type": rating_signal(r.value),
            "created_at": r.created_at,
        })

    wh = (await db.execute(select(WatchHistory))).scalars().all()
    for w in wh:
        m = movies.get(w.movie_id)
        if not m:
            continue
        pct = w.completion_pct or 0.0
        sig = "watched" if pct >= 90 else "watched_partial" if pct >= 70 else "abandoned" if pct < 30 else None
        if sig is None:
            continue
        timelines.setdefault(w.user_id, []).append({
            "movie_data": _movie_data(m),
            "signal_type": sig,
            "created_at": w.watched_at,
        })

    return timelines


def _movie_data(m: Movie) -> dict:
    return {
        "id": m.id, "genres": m.genres, "vote_average": m.vote_average,
        "popularity": m.popularity, "runtime": m.runtime,
        "release_date": m.release_date, "original_language": m.original_language,
    }


def _reconstruct(imp: Impression, movies: dict, timeline: list[dict]) -> list[float] | None:
    movie = movies.get(imp.movie_id)
    if movie is None:
        return None
    prior = [i for i in timeline if i.get("created_at") and i["created_at"] < imp.shown_at]
    taste_vec = compute_user_taste_vector(prior)
    return build_feature_row(
        _movie_data(movie),
        taste_vec=taste_vec,
        user_genres=user_genre_set(prior),
        languages=set(),          # historical language prefs not stored; neutral
        mood_pacing=0.0,
        genre_completion_map={},
    )


# ── Metrics ──────────────────────────────────────────────────────

def _precision_at_k(slates: list[Slate], k: int, order: Callable[[SlateItem], float]) -> float:
    """Mean over slates of (converted items in the top-k of `order`) / k."""
    totals = 0.0
    n = 0
    for s in slates:
        top = sorted(s.items, key=order, reverse=True)[:k]
        if not top:
            continue
        totals += sum(1 for it in top if it.converted) / k
        n += 1
    return totals / n if n else 0.0


def evaluate(
    slates: list[Slate],
    score_fn: ScoreFn | None = None,
    *,
    item_score_fn: Callable[[SlateItem], float] | None = None,
    k: int = 10,
    reconstructed: int = 0,
    min_impressions: int = DEFAULT_MIN_IMPRESSIONS,
    min_conversions: int = DEFAULT_MIN_CONVERSIONS,
) -> Report:
    """Compare a candidate ordering against the served order (baseline).

    Pass `score_fn(features)` for a pure feature-vector scorer (XGBoost), or
    `item_score_fn(item)` when the score needs the item's user/movie (ALS)."""
    impressions = sum(len(s.items) for s in slates)
    conversions = sum(1 for s in slates for it in s.items if it.converted)

    scorer = item_score_fn or (lambda it: score_fn(it.features))

    # Baseline = the order actually served (lower position shown first).
    base_p = _precision_at_k(slates, k, order=lambda it: -it.position)

    # Candidate = re-rank each slate by the candidate scorer (higher first).
    cand_scores: dict[int, float] = {}
    for s in slates:
        for it in s.items:
            cand_scores[id(it)] = float(scorer(it))
    cand_p = _precision_at_k(slates, k, order=lambda it: cand_scores[id(it)])

    return Report(
        slates=len(slates),
        impressions=impressions,
        conversions=conversions,
        baseline_precision_at_k=base_p,
        candidate_precision_at_k=cand_p,
        take_rate=(conversions / impressions) if impressions else 0.0,
        k=k,
        sufficient=impressions >= min_impressions and conversions >= min_conversions,
        reconstructed=reconstructed,
    )
