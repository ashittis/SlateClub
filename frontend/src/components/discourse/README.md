# discourse components — hot takes, polls & film discussion

The opinionated discussion UI: spicy "hot takes", polls, and the per-film discussion section.

## Components
- **`FilmDiscussSection.tsx`** — the discussion block on a film page (takes + polls together).
- **`HotTakeCard.tsx`** — a single hot take with reactions.
- **`HotTakeComposer.tsx`** — compose a new hot take.
- **`PollCard.tsx`** — a poll with vote options and live results.

## Notes
- Voting/reacting updates optimistically then confirms with the server; result bars animate
  with Framer Motion.
- Calls the `discourse` endpoints (hot takes, reactions, polls, votes).
