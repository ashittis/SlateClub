# artists — filmmaker & actor pages

Pages for people (directors, actors): their filmography, posts, AMAs (ask-me-anything),
and the ability to follow an artist.

## Files
- **`routes.py`** — artist profile + filmography (from TMDB), artist posts, AMA threads and
  questions, and follow/unfollow an artist.
- **`models.py`** — `Artist`, `ArtistPost`, `AMA`, `AMAQuestion`, `ArtistFollow`.

## How it works
1. An artist page pulls the person's credits from TMDB and merges them with local
   `Artist`/`ArtistPost` content.
2. Following an artist (`ArtistFollow`) surfaces their posts/AMAs in the user's feed.

## Talks to
- shared models: `user`; own model: `artists`
- external: TMDB
