# shared/services — cross-cutting business logic

Logic that's more than simple CRUD and is used by **several** features. Routes stay thin;
the real work lives here.

## Files
- **`notify.py`** — the notification *writer*: `create(...)` inserts a `Notification` of a
  given kind. Called by follows, orbits, dms, reviews, slates, match-cut.
- **`taste_cache.py`** — Redis-backed cache of a user's taste vector and derived data.
  Written on every taste-changing action, read on every recommendation. Invalidated by
  ratings / watches / feedback.
- **`watch_signals.py`** — turns raw actions (watch, rate, feedback) into taste updates:
  refreshes the taste vector, nudges the contextual bandit, and updates `UserTasteState`.
- **`diary_service.py`** — shared diary/logging logic used by diary, imports, and movies.
- **`impressions.py`** — records which cards were actually shown (`Impression`) so the
  ranker can learn from shown-vs-clicked.
- **`taste_embedding.py`** — builds a user's taste embedding from their actions + onboarding,
  optionally described in words via the LLM.
- **`trending.py`** — fetches trending films from TMDB and upserts them.
- **`geo.py`** — small geo helpers (distance, nearby) for theatres/showtimes.
- **`reddit_enrich.py`** — fetches & caches Reddit discussion for a film (`RedditCache`).

## How it works
Features call these instead of duplicating logic. The taste-related trio
(`taste_cache` → `watch_signals` → `taste_embedding`) is the write-path that keeps a user's
taste fresh; `ml/` is the read-path that consumes it.

## Talks to
- shared models (`social`, `actions`, `movie`, `onboarding`, `notifications`, caches)
- ml (`embeddings.taste_vector`, `llm.contextual_bandit`, `graph.taste_graph`)
- core (`redis_client`), integrations (`tmdb`, `reddit`)
