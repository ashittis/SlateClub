# features — one folder per user-facing system

A slice owns its routes and the tables only it touches. Tables used by many
slices live in `app/shared/models/`. Register every router in
`app/routes/__init__.py` and every model module in `app/models_registry.py`.

| Slice | What it does | Status |
|---|---|---|
| `auth` | signup, login, refresh, logout, JWT-in-cookie sessions | stable |
| `onboarding` | five steps of cold-start taste signal | stable |
| `films` | search, browse, detail, the viewer's relationship to a film | stable |
| `diary` | one row per viewing — the centre of the product | stable |
| `ratings` | current opinion, and the default watchlist | stable |
| `reviews` | writing, bound to the viewing that prompted it | stable |
| `passport` | cinematic identity: profile, stats, favourites | stable |
| `social` | follows, activity, direct messages | stable |
| `users` | people search and account preferences | stable |
| `discovery` | search now; the evidence engine in Phase 8 | in progress |
| `notifications` | read side; the writer is `shared/services/notify` | stable |
| `imports` | Letterboxd CSV → real diary entries | stable |

Removed in the rebase: recommendation, artists, releases, watch_parties,
match_cut, slates, movies (→ `films`), community (→ `social`), and activity
(→ `social`). See `KASET.md` §2. Watchlists and blends return in Phase 9.
