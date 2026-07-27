# releases — what's new and where to watch it

Time-and-place oriented film info: upcoming/new releases, the cultural context around a
film, and local theatre showtimes.

## Route files
- **`releases.py`** — the release calendar / carousel of upcoming & recent films.
- **`cultural.py`** — "cultural context": background, connections, and why-it-matters notes
  for a film (`CulturalContext`).
- **`theatres.py`** — nearby theatres and their showtimes.

## Other files
- **`service.py`** — fetches and refreshes release data from TMDB, upserting films via
  `features/movies._upsert_movie`.
- **`models/`** — the owned tables (see [`models/`](models/)).

## How it works
1. `service.py` pulls the release feed from TMDB on a schedule/request and upserts each film.
2. `cultural.py` attaches editorial/graph context to a film; `theatres.py` answers
   "where can I see this near me" using the `geo` helper.

## Talks to
- shared models: `movie`, `actions`; own models: `releases`, `cultural`, `theatres`
- shared services: `geo`; feature service: `releases`
- external: TMDB
