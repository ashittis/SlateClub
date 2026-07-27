# features — the vertical slices

One folder per user-facing feature. Each slice owns its API routes and the models/services
only it uses; anything shared lives in `app/shared`, `app/core`, `app/ml`, or
`app/integrations`. Open any slice's own README for detail.

| Slice | What it is |
|---|---|
| `auth` | signup / login / JWT sessions |
| `users` | profiles + the follow/orbit social graph |
| `movies` | film & series detail (+ the shared movie-fetch helpers) |
| `ratings` | rate / watchlist / diary / reviews / DNF / wrapped |
| `discovery` | home feed, search, discovery rows |
| `recommendation` | the taste-engine API (recs, taste identity, tribes, anchors) |
| `match_cut` | taste-blend matching game |
| `community` | posts, hot takes, polls, circles, chapters, festivals, DMs, chat |
| `onboarding` | first-run taste calibration |
| `artists` | filmmaker/actor pages, AMAs |
| `releases` | release calendar, cultural context, theatres |
| `watch_parties` | synchronised group viewings |
| `slates` | curated film collections |
| `notifications` | the alert inbox (writer is `shared/services/notify`) |
| `activity` | the friends' activity feed |
| `imports` | import history from external services |

Each slice's router is registered in [`../routes/__init__.py`](../routes/__init__.py).
