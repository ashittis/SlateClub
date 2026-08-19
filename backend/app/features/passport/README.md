# passport — a user's cinematic identity

The profile, reconceived (KASET.md §8). It shows who someone is *as a viewer*:
what they've watched, what they love, what they've written, and how that looks
over a month or a year.

## One shape, two viewers

`/me` and `/{username}` return an **identical payload**, so the client renders
one component either way. What differs is privacy, and it is enforced here
rather than in the client:

- A viewer who isn't the owner never receives private viewings.
- Stats are computed over the same filtered set, so the numbers match what's
  shown. A private viewing changes your own average rating but not a stranger's
  view of it.
- `profile_visibility` (`public` / `followers` / `private`) is checked once in
  `_assert_visible`; a refused passport is a 403, not a thinner payload the
  client would have to defensively interpret.

## Stats are derived, never stored

`stats.py` computes everything from the diary at request time, so the numbers
can't drift from what was actually logged.

**`films` and `viewings` are separate on purpose.** They diverge the moment
someone rewatches, and collapsing them into one "films watched" figure is the
easiest way to make a Wrapped card lie.

`hoursWatched` counts only films whose runtime TMDB gave us — it reads low
rather than invented when the catalog is thin. Most-watched people are counted
per *viewing* and from billed cast only, so a director you rewatch outranks one
you saw once, and extras don't outrank leads.

## Endpoints
- `GET /me` · `PATCH /me` — your passport, and editing it
- `GET /{username}` — someone else's
- `GET /{username}/stats?period=all|year|month&year=&month=` — the basis of
  monthly/yearly sharing and Wrapped (Phase 10)
- `GET /{username}/diary` · `/reviews` · `/watchlist`
