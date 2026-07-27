# ratings — logging what you watched and thought

Everything that records a user's relationship with a film: rating it, adding it to a
watchlist, marking it watched, writing a diary entry or review, "did not finish", and the
year-in-review recap. These all read/write the shared `actions` tables.

## Files
- **`ratings.py`** — rate a film (1–10). Updates taste signals and busts `taste_cache`.
- **`watchlist.py`** — add/remove films from the watchlist (`WatchlistItem`).
- **`watch_history.py`** — mark films watched (`WatchHistory`), feeding `watch_signals`.
- **`diary.py`** — dated diary entries with notes; also "currently watching" and DNF.
- **`reviews.py`** — long-form reviews (`Review`); notifies followers via `notify`.
- **`critics.py`** — review votes / critic surfacing (helpful-vote logic on reviews).
- **`feedback.py`** — quick micro-feedback (thumbs) that tunes recommendations
  (`MicroFeedback` in shared `social`).
- **`wrapped.py`** — "Wrapped": a year-in-review built from the user's ratings & watches.

## How it works
1. Each action writes to a table in `shared/models/actions` (or `social` for micro-feedback).
2. Writes that change taste (rate, watch, feedback) call `shared/services/watch_signals`
   and invalidate the cached taste vector so recommendations stay fresh.
3. `wrapped.py` aggregates a year of rows into shareable stats and reuses
   `features/users`' `_movie_payload` to render films.

## Talks to
- shared models: `actions`, `movie`, `social`, `user`
- shared services: `watch_signals`, `taste_cache`, `diary_service`, `notify`
- cross-slice: `features/users._movie_payload`, `features/movies._get_or_fetch_movie`
