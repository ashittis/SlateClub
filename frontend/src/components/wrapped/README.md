# Wrapped components — the year-in-review story

This is SlateClub's "Wrapped" — a Spotify-Wrapped-style, tap-through story that recaps a user's year in film: how much they watched, their highest-rated titles, most-rewatched, top genres and moods, director of the year, and their first/last films.

## Components
- **`WrappedStory.tsx`** — the full-screen vertical story player. It builds a sequence of cards from the year's data (only including cards it has data for), then plays them one at a time with segmented progress bars, tap-left/tap-right (or arrow-key) navigation, and a shifting cinema-dark gradient background per card. Cards include the intro year splash, big film/hours counts, a habits stat grid, top-rated list, on-repeat film, genre bars, director-of-the-year, first/latest "bookends," and an outro.

## Notes
Everything is one self-contained component; it takes a `WrappedData` prop (also exported here) and the parent supplies the numbers. Framer Motion drives it heavily: `AnimatePresence` slides cards in/out by direction, and a `stagger`/`rise` variant set choreographs each card's elements rising into place with spring physics. Built phone-first — fixed to `100dvh`, `max-w-md`, with full-height left/right tap zones (≥44px) for thumb navigation and keyboard support as a desktop bonus. Posters and the amber→crimson brand gradient carry the visual identity throughout.
