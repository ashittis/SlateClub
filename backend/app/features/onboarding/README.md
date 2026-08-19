# onboarding — five steps, structured facts only

    languages → favourite films → favourite cast/crew → preferences → ready

The purpose is cold-start personalisation and nothing else (KASET.md §8). Every
step writes plain rows that later systems read directly. Nothing here is
inferred, scored, or embedded.

## Endpoints
- `POST /languages` — replace the language set
- `GET  /films/search` · `POST /films` — favourite films (max 8, order preserved)
- `GET  /people/search` · `POST /people` — favourite cast/crew (max 8)
- `POST /preferences` — platforms, decades, theatre preference (all optional)
- `POST /complete` — flip `users.onboarded`
- `GET  /status` — everything chosen so far, so the client can resume mid-flow

## Rules
- **Only step 1 is required.** Films, people and preferences are each skippable,
  and `/complete` is deliberately unguarded — a user who skipped everything still
  gets into the app.
- **Every setter replaces the whole set**, so re-submitting is idempotent and the
  client can post freely on each edit.

## What was removed

SlateClub's 8-step "Tune Your Taste" flow also collected a poster gut test,
three mood sliders and an "origin film" — 13 endpoints in total. Those fed the
25-dimensional taste vector, which no longer exists. Keeping them would have
meant asking users questions nothing reads.

`onboarding_signals` became `viewing_preferences` in migration
`0002_viewing_preferences`, keeping only the fields something consumes.
