# ml/models — the trained recommendation models

The actual ML models behind the pipeline. Several candidate generators plus one ranker,
trained offline by `backend/scripts/` and loaded at request time.

## Files
- **`als.py`** — ALS matrix factorization: collaborative-filtering candidates from the
  user×film rating matrix (trained by `scripts/train_als.py`).
- **`content_based.py`** — content/tone-similarity candidates (film features → nearest films).
- **`two_tower.py`** — a two-tower (user tower / item tower) retrieval model for candidates.
- **`xgboost_ranker.py`** — the final **ranker**: scores candidates with a learning-to-rank
  XGBoost model over taste + context features (trained by `scripts/train_xgboost.py`).

## How it works
The candidate stage of the pipeline blends ALS + content-based + two-tower + graph output
into a pool; the rank stage then orders that pool with `xgboost_ranker`. Trained artifacts
live under `ml/models/artifacts/`; `ml/eval` measures them offline.
