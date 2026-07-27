# integrations — external API clients

Thin wrappers around the third-party services the app pulls data from. Keeping them here
means features never call external APIs directly.

## Files
- **`tmdb.py`** — the TMDB client: search films/people, fetch film & credit details,
  posters, trending. The source of truth for catalog data; results are mirrored into the
  local `Movie` table via `features/movies._upsert_movie`.
- **`reddit.py`** — fetches Reddit discussion threads for a film, used by
  `shared/services/reddit_enrich` to add community-context to films (cached in `RedditCache`).

## How it works
These modules only know how to talk to the outside world and return raw/typed payloads.
Turning those payloads into DB rows (upserting movies, caching discussions) is done by the
services/features that call them.
