# shared/models — tables many slices touch

A table lives here only when several features genuinely share it. Anything owned by one
feature belongs in that slice. Every module here must be imported by
`app/models_registry.py` or Alembic will not see it.

- **`user.py`** — `users`, `user_preferences`. Everything cascades off `users`.
- **`movie.py`** — `movies`. The central content object, upserted lazily from TMDB.
- **`actions.py`** — what a user does to a film: `ratings`, `watchlist_items`,
  `watch_history`, `watch_log` (the diary), `currently_watching`, `dnf_entries`, `reviews`.
- **`social.py`** — `follows`, `activity_events`.
- **`onboarding.py`** — `language_selections`, `favorite_movies`, `favorite_people`,
  `onboarding_signals`.
- **`reddit_cache.py`**, **`discovery_cache.py`** — warm caches for the discovery engine.
  Safe to truncate; they re-warm offline.

## The distinction that matters

`ratings` is the user's *current* opinion of a film — one row per (user, film).
`watch_log` is one row per *viewing*, with no unique constraint, so rewatches are
separate dated rows that never overwrite each other. `watch_history` is a derived
summary so "has this user seen it?" stays a single indexed lookup.
