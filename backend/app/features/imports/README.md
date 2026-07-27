# imports — bring in your history from elsewhere

Bulk import of a user's watch history / ratings from external services (e.g. a Letterboxd
export), matching each title to a real film and writing it into the user's diary & ratings.

## Files
- **`routes.py`** — accept an import payload, resolve each title against TMDB, and create
  the corresponding `WatchHistory` / `DiaryEntry` / `Rating` rows.

## How it works
1. Each imported row's title/year is matched to a `Movie` via TMDB (inserting if new).
2. Matched rows are written through `shared/services/diary_service` so they behave exactly
   like natively-logged entries (and feed taste signals).

## Talks to
- shared models: `actions`, `movie`, `user`
- shared services: `diary_service`
- external: TMDB
