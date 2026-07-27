# movies — film & series detail, plus the shared movie-fetch helpers

The film and TV pages, and — importantly — the two helper functions that the *whole app*
uses to resolve a film from TMDB into the local `Movie` table.

## Files
- **`movies.py`** — the movie detail endpoint (metadata, ratings summary, your history,
  social context). It also defines two widely-reused helpers:
  - `_get_or_fetch_movie(...)` — return a local `Movie`, fetching+inserting from TMDB if missing.
  - `_upsert_movie(...)` — insert/update a `Movie` row from a TMDB payload.
  These are imported by series, dms, slates, users, recommendations, and several services —
  they are the single source of truth for "get me a movie row".
- **`series.py`** — TV series view: seasons/episodes, season & episode ratings. Reuses
  `_get_or_fetch_movie` to resolve the series itself.

## How it works
1. A film page calls `movies.py`, which resolves the `Movie` (local or TMDB), loads the
   viewer's `Rating`/`WatchHistory`/`DiaryEntry`, and attaches social signals.
2. Viewing/rating a film feeds `shared/services/watch_signals` and busts `taste_cache`.

## Talks to
- shared models: `movie`, `actions`, `social`, `user`
- shared services: `diary_service`, `taste_cache`, `watch_signals`
- external: TMDB

> Note: `_get_or_fetch_movie` / `_upsert_movie` are effectively a shared movie service that
> happens to live here. Other slices import them from `app.features.movies.movies`.
