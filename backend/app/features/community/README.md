# community — social discussion surfaces

All the ways users talk *to each other* around films: posts, hot takes & polls, comments,
taste circles, chapters (local groups), festivals, direct messages, and chat. Each route
file is one discussion surface; the tables they own live in `models/`.

## Route files
- **`posts.py`** — feed-style posts with replies and upvotes (`Post`, `PostReply`, `PostUpvote`).
- **`discourse.py`** — hot takes, reactions, and polls (`HotTake`, `Poll`, `ReviewVote`, …).
- **`comments.py`** — comments on activity/reviews (uses shared `Comment` table).
- **`circles.py`** — "taste circles": small invite groups with a shared message thread.
- **`chapters.py`** — "chapters": location/interest groups with events.
- **`festivals.py`** — festival hubs and their posts.
- **`dms.py`** — one-to-one **film** DMs — sharing a specific movie with a note.
- **`chat.py`** — general DM conversations and messages.

## How it works
1. Each surface is standard CRUD over its own tables plus the shared `User`/`Follow` graph.
2. Actions that should reach another user (a reply, a DM, an invite) call
   `shared/services/notify` to create a `Notification`.
3. `dms.py` can attach a real film — it uses `features/movies`' `_get_or_fetch_movie`
   helper to resolve/insert the movie first.

## Talks to
- shared models: `user`, `social` (Follow), `actions` (Comment), `movie`
- shared services: `notify`
- owned models: see [`models/`](models/)
