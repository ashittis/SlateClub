"""
Taste Drift Detection (ARCHITECTURE.md Section 1.2 + 1.6)

Detects when a user's recent taste diverges from their established pattern.

drift_score = 1 - cosine_similarity(taste_vector_last_30d, taste_vector_lifetime)

if drift_score > 0.35 → "taste phase transition"
if drift_score < 0.15 for 90 days → "stable taste"
"""

from datetime import datetime, timedelta, timezone

from app.ml.embeddings.taste_vector import compute_user_taste_vector, cosine_similarity

DRIFT_THRESHOLD = 0.35
STABLE_THRESHOLD = 0.15


def compute_drift_score(
    all_interactions: list[dict],
    recent_days: int = 30,
) -> dict:
    """
    Compute taste drift score between recent and lifetime taste vectors.

    Returns:
        {
            drift_score: float (0-1, higher = more drift),
            phase_transition: bool,
            stable: bool,
            recent_vector_norm: float,
            lifetime_vector_norm: float,
        }
    """
    if len(all_interactions) < 5:
        return {
            "drift_score": 0.0,
            "phase_transition": False,
            "stable": True,
            "message": "Not enough data to detect drift",
        }

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=recent_days)

    recent = []
    older = []
    for i in all_interactions:
        created = i.get("created_at")
        if created:
            if isinstance(created, str):
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            if created >= cutoff:
                recent.append(i)
            else:
                older.append(i)
        else:
            older.append(i)

    if not recent or not older:
        return {
            "drift_score": 0.0,
            "phase_transition": False,
            "stable": True,
            "message": "Need both recent and older interactions",
        }

    # Compute vectors
    recent_vec = compute_user_taste_vector(recent)
    lifetime_vec = compute_user_taste_vector(all_interactions)

    import numpy as np
    recent_norm = float(np.linalg.norm(recent_vec))
    lifetime_norm = float(np.linalg.norm(lifetime_vec))

    similarity = cosine_similarity(recent_vec, lifetime_vec)
    drift_score = 1.0 - similarity

    phase_transition = drift_score > DRIFT_THRESHOLD
    stable = drift_score < STABLE_THRESHOLD

    return {
        "drift_score": round(drift_score, 3),
        "phase_transition": phase_transition,
        "stable": stable,
        "similarity": round(similarity, 3),
        "recent_interaction_count": len(recent),
        "older_interaction_count": len(older),
        "recent_vector_norm": round(recent_norm, 3),
        "lifetime_vector_norm": round(lifetime_norm, 3),
    }


def get_drift_adaptations(drift_result: dict) -> list[dict]:
    """
    Return recommended adaptations based on drift detection.
    Maps to the Taste Drift Adaptation table in Section 1.6.
    """
    if not drift_result.get("phase_transition"):
        return []

    return [
        {
            "adaptation": "accelerated_decay",
            "description": "Older preferences (>60 days) weighted at 0.5× for 30 days",
        },
        {
            "adaptation": "exploration_boost",
            "description": "Explore/exploit ratio shifts to 50/50 (from 70/30)",
        },
        {
            "adaptation": "recalibration_prompt",
            "description": "Show: 'Your taste seems to be evolving. Want to update your preferences?'",
        },
        {
            "adaptation": "cluster_reevaluation",
            "description": "Trigger off-cycle Louvain re-run for this user's neighborhood",
        },
        {
            "adaptation": "taste_identity_update",
            "description": "Force immediate taste identity recompute",
        },
    ]
