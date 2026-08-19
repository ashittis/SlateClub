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
- **`ShareFilmSheet.tsx`** — send a film to someone. Goes into the normal
  conversation model, so they can reply.
- **`FilmCard.tsx`**, **`ExpandableSynopsis.tsx`** — shared display pieces.

Logging itself lives in `components/log/`, because it's owned by the diary. It
now renders **inline on this page**, taking the primary button's slot rather
than opening a sheet over it — so the two are mutually exclusive and the page
keeps exactly one `--tape`-filled control. The page's "Your rating" row hides
while the panel is open; see `components/log/README.md` for why.
