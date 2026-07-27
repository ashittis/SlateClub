# recommendation — the taste engine's API surface

The routes that turn a user's taste into recommendations, taste identity, tribes, and
"anchors". This slice is the front door to the `ml/` recommendation engine — it gathers
signals, calls the pipeline, and shapes the results for the UI.

## Files
- **`recommendations.py`** — the main rec endpoint. Assembles the user's signals
  (ratings, drift, onboarding, taste vector), runs `ml/pipeline/recommendation_pipeline`
  (candidates → filter → rank → contextualize), and returns ranked films with reasons.
- **`taste.py`** — the user's taste identity: describes their taste in words
  (`ml/llm/taste_describer`), detects drift over time (`drift_detector`), and exposes the
  contextual-bandit state that tunes exploration vs exploitation.
- **`tribes.py`** — "taste tribes": groups of users found via graph community detection
  on the Neo4j taste graph.
- **`anchors.py`** — taste "anchors": the reference films that define a user's taste,
  refined with an LLM.
- **`taste_engine.py`** — the "movies like X" similar-films engine endpoint.
- **`models.py`** — `TastePreset` (saved taste-engine presets).
- **`similar_films.py`** — service: computes similar films (TMDB + taste vectors + LLM),
  cached in `SimilarCache`.

## How it works
1. A request to `recommendations.py` collects the user's live signals and hands them to the
   4-stage ML pipeline.
2. The pipeline returns ranked candidates; the route attaches human-readable reasons and
   records impressions.
3. `taste.py` / `tribes.py` / `anchors.py` expose the *why* behind recommendations
   (identity, drift, community, anchor films).

## Talks to
- ml: `pipeline.recommendation_pipeline`, `embeddings.taste_vector`, `graph.*`,
  `llm.contextual_bandit / drift_detector / taste_identity / taste_describer`
- shared models: `user`, `movie`, `actions`, `social`, `onboarding`, `similar_cache`
- shared services: `impressions`; feature: `similar_films`
- external: TMDB
