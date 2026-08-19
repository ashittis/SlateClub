# film — the film page's parts

The film page is Kaset's central content object, and its primary action is
**Log this film**. Components here support that; they never duplicate it.

- **`ViewingHistory.tsx`** — your own logged viewings, newest first, as a real
  table. This is where rewatch becomes *visible* rather than merely stored:

      2026   ★★★★★ ♥   rewatch
                       #imax
      2024   ★★★★★     theatre

  It reads `/api/films/{id}/viewings` — note the field names are `watchedOn` and
  `watchType`, not `watchedAt`/`atTheatre`. An earlier `Viewing` interface
  declared the latter pair, which the endpoint has never sent; because the type
  was asserted rather than validated it typechecked cleanly and only blew up at
  render. Keep `lib/api/films.ts` honest against the route.

- **`CommunityReviews.tsx`** — what other people wrote. Each review shows the
  author's rating beside it: a review reads very differently next to the score
  it came with, and separating them is how a three-star review gets mistaken
  for a pan. Spoilers hide behind a click, because a warning you've already read
  isn't a warning.
- **`FilmActionPanel.tsx`** — everything you can do to a film, in one column:
  the Watched/Rate/Watchlist triad, the rating stars, then log, watchlist and
  share. These actions used to run down the middle of the page, so the synopsis
  began below a stack of controls; collected into a sidebar they read as what
  they are, and stay in a known place while you scroll the writing.
- **`FriendsWatched.tsx`** — who among the people you follow has logged this,
  and what they gave it. Renders nothing when the answer is nobody: an empty
  "no friends yet" panel makes a quiet network feel like a broken feature.
- **`ShareFilmSheet.tsx`** — send a film to someone. Goes into the normal
  conversation model, so they can reply.
- **`QuickActions.tsx`** — long-press a poster: rate, quick-log, watchlist, or
  open the full log dialog without leaving the page.
- **`FilmCard.tsx`**, **`ExpandableSynopsis.tsx`** — shared display pieces.
  `FilmCard` takes an optional `footer` (drawn under the poster, inside the
  card) and `caption` (`null` suppresses the title/year lines) — the home feed's
  friend-attribution chip is built from both.

## Layout

Three columns at `lg`: poster rail, the writing, the action panel. Below that
they stack and the primary action pins itself to the bottom of the viewport —
on a phone a sidebar is just more scrolling.

Logging itself lives in `components/log/`, because it's owned by the diary. It
is now a dialog raised over this page rather than an inline panel, and the page
opens it through `stores/logStore.ts`; see `components/log/README.md` for why
that changed. Exactly one `--blood`-filled control on screen at a time still
holds — the panel's log row, or the mobile action bar, never both.
