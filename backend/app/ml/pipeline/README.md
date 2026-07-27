# ml/pipeline — the 4-stage recommendation pipeline

The orchestrator that ties every model together into a single call. This is what
`features/recommendation/recommendations.py` invokes.

## Files
- **`recommendation_pipeline.py`** — runs the four stages in order and returns ranked,
  explained films.

## The stages
1. **Candidates** — gather a broad pool from ALS, content-based, two-tower, graph, and
   trending generators.
2. **Filter** — remove already-seen, unavailable, disliked, or out-of-context films.
3. **Rank** — score the survivors with `ml/models/xgboost_ranker` over taste + context.
4. **Contextualize** — attach reasons, apply the current session mood, and diversify so the
   list doesn't feel same-y.

## Talks to
- ml: `models.*`, `graph.*`, `embeddings.taste_vector`, `llm.contextual_bandit`
- shared services: `taste_cache` (read taste), `impressions` (what was shown)
