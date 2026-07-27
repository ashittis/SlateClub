# layout components — app chrome

The persistent navigation shell that wraps the `(main)` route group.

## Components
- **`LeftRail.tsx`** — the desktop Spotify-style rail (hidden below `lg`): logo, `+ Create`,
  primary nav (from `@/lib/nav`), a divider, then library shortcuts (your Slates + Circles).
- **`TopNav.tsx`** — the desktop top bar, offset right of the rail: persistent search input +
  right cluster (messages, notifications, avatar dropdown). Primary nav moved to the rail.
- **`CreateMenu.tsx`** — the global `+` create menu (rail button or mobile FAB): Slate,
  Collaborative Slate, Match Cut, AI Slate (Beta), New Post. Wires to existing creation surfaces.
- **`ContinueWatchingBar.tsx`** — persistent bottom "resume" bar derived from
  `/api/users/me/watching`; collapses to nothing when idle. Toggles `[data-cw-active]` on `body`
  so `globals.css` reserves matching bottom padding.
- **`navIcons.tsx`** — shared nav icon map keyed by href, used by both the rail and mobile tabs.

## Notes
- Rendered by `(main)/layout.tsx` (rail + top bar on desktop, bottom-tab bar + create FAB on
  mobile). Touch targets ≥44px; no hover-only affordances so it works on mobile.
