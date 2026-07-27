# ml — the recommendation & taste engine

SlateClub's differentiator: recommending by **tone, pacing, and storytelling style**, not
just genre. This package is the read-path — given a user's taste, it produces ranked,
explained film recommendations. The write-path (keeping taste fresh) lives in
`shared/services`.

```
ml/
  recommendationengine.py  top-level orchestration entry point
  embeddings/  taste vectors — the numeric representation of taste
  graph/       Neo4j taste graph — similarity, communities, graph recs
  llm/         LLM helpers — describe taste, detect drift, bandit, movie identity
  models/      the ML models — ALS, content-based, two-tower, XGBoost ranker
  pipeline/    the 4-stage pipeline that ties it all together
  eval/        offline evaluation harness
```

## The 4-stage pipeline (`pipeline/recommendation_pipeline.py`)
1. **Candidates** — gather a broad pool (ALS + content-based + graph + trending).
2. **Filter** — drop already-seen / unavailable / disliked films.
3. **Rank** — score with the XGBoost ranker over taste + context features.
4. **Contextualize** — attach human reasons ("because you liked…") and apply session mood.

`features/recommendation` calls this pipeline; the models here are trained offline by the
scripts in `backend/scripts/` (`train_als.py`, `train_xgboost.py`) and evaluated via `eval/`.

See each subfolder's README for detail.
