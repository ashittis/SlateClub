# users — profiles and the follow graph

User profiles plus the two relationship types that power the social graph: public
**follows** and closer **orbits** (mutual/close-friend requests).

## Files
- **`users.py`** — profile endpoints: a user's films, stats, favourites, and activity.
  Defines the shared `_movie_payload(...)` helper that renders a `Movie` (+ the viewer's
  own rating/status) into the standard API shape used across the app.
- **`follows.py`** — follow / unfollow (`Follow`); sends a notification on new follows.
- **`orbits.py`** — "orbit" requests: send/accept/decline a closer-friend link
  (`OrbitRequest`), which unlocks orbit-only content.

## How it works
1. `users.py` loads a profile by username, pulls their public activity and favourites, and
   renders films through `_movie_payload` (which many other slices import).
2. `follows.py` / `orbits.py` mutate the shared `social` graph and notify the other user via
   `shared/services/notify`.

## Talks to
- shared models: `user`, `social` (Follow/OrbitRequest), `actions`, `movie`, `onboarding`
- shared services: `notify`
- cross-slice: `features/movies._get_or_fetch_movie`
