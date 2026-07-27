# feed components — the home feed

The landing feed: scoped tabs, a hero poster fan, the session-mood bar, and the grids that
fill For You / Browse.

## Components
- **`FeedScopeTabs.tsx`** — the tab switcher (For You / Browse / friends scope).
- **`HeroFan.tsx`** — the animated fanned-out poster hero at the top of the feed.
- **`ForYouGrid.tsx`** — the personalised recommendation grid.
- **`BrowseGrid.tsx`** — the general browse grid.
- **`SessionMoodBar.tsx`** — a mood selector that filters the feed to the current vibe.
- **`MovieSearchBar.tsx`** — inline search entry from the feed.
- **`NewUserPrompt.tsx`** — cold-start card ("Rate a few films to get started") shown on Home
  until the user has enough ratings for personalisation.
- **`rows/`** — the spec's Home rails, each a self-hiding `FeedRow`: `JumpBackInRow`
  (`/api/users/me/watching`), `ContinueSlatesRow` (`/api/slates/mine`), `TrendingNearYouRow`
  (`/api/feed/city-trending`).

## Notes
- `HeroFan` uses choreographed motion (GSAP/Framer) to fan posters like a hand of cards.
- The mood bar re-queries the feed with a mood filter; grids lazy-load and log impressions.
- Calls the feed API (`/feed`) with scope + mood params.
