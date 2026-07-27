# match_cut — the taste-blend matching game

"Match Cut" pairs two users (or a group) and finds the films that sit at the intersection
of their tastes — a shared-watchlist / blend experience, like a movie version of a music
blend.

## Files
- **`routes.py`** — endpoints to create a match-cut session, invite friends, and fetch the
  blended film grid.
- **`service.py`** — the matching logic: compares users' taste vectors and rated films to
  produce the overlapping recommendations, cached via `taste_cache`.
- **`models.py`** — `MatchCut` (a session) and `MatchCutMember` (its participants).

## How it works
1. A user starts a `MatchCut` and invites friends → each becomes a `MatchCutMember`
   (a notification is sent via `shared/services/notify`).
2. `service.py` intersects the members' taste vectors and watch signals to rank films both
   sides would enjoy.
3. The route returns the blended grid; results are cached so re-opening is instant.

## Talks to
- shared models: `user`; own model: `match_cut`
- shared services: `notify`, `taste_cache`
- ml: `embeddings.taste_vector`
