# films — the central content object

Search, browse, detail, and the viewer's relationship to a film. Every path in
Kaset leads here, and the page's primary action is **Log this film**.

This slice deliberately does **not** own logging. `/api/diary` does, with
`shared/services/diary_service` as the single writer for the
diary/rating/watch-history trio. Keeping the two apart is what stops a film page
from quietly fabricating viewings.

## Addressing

Routes take a **TMDB id**, not an internal uuid, so the client can act on a film
straight from a search result without a resolve round-trip. Resolution happens
in `shared/services/films.get_or_fetch_film`, which caches the film locally the
first time anyone touches it — Kaset never pre-imports a catalog.

## Endpoints
- `GET /search` · `GET /trending` · `GET /popular`
- `GET /{tmdb_id}` — full detail: overview, genres, directors, cast
- `GET /{tmdb_id}/status` — watchlist, rating, review, log count, `seen`
- `GET /{tmdb_id}/viewings` — this viewer's own history, newest first
- `POST`/`DELETE /{tmdb_id}/watchlist` · `POST /{tmdb_id}/rate`
- `POST`/`DELETE /{tmdb_id}/watching`
- `GET /people/{person_id}` — a director or actor and their filmography

## What changed from SlateClub's `movies` slice

`media_type` and every TV branch are gone (Kaset is films only). The `watched`
endpoints are gone too — a viewing is a diary entry, never a boolean. DNF is
gone; it was not one of the twenty V1 systems. The resolve/serialize helpers
that used to be private functions imported across slice boundaries now live in
`shared/services/films.py`.
