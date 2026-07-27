# slates — curated film collections

"Slates" are the app's curated lists — a mixtape of films. They can be collaborative,
liked, saved, and have a live "slate room" chat. Think Spotify playlists for movies.

## Files
- **`routes.py`** — create/edit slates, add/reorder films, like/save, manage collaborators,
  and post in the slate room.
- **`models.py`** — `Slate`, `SlateFilm`, `SlateCollaborator`, `SlateLike`, `SlateSave`,
  `SlateRoomMessage`.

## How it works
1. A user creates a `Slate` and adds films — each film is resolved through
   `features/movies._get_or_fetch_movie` so the local `Movie` exists.
2. Collaborators (via `SlateCollaborator`) can also add films; changes notify participants
   through `shared/services/notify`.
3. Likes/saves (`SlateLike`/`SlateSave`) drive discovery ranking; the slate room
   (`SlateRoomMessage`) is a lightweight group chat scoped to the slate.

## Talks to
- shared models: `movie`, `social`, `user`; own model: `slates`
- shared services: `notify`
- cross-slice: `features/movies._get_or_fetch_movie`
