# frontend/src — structure map

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · Framer Motion ·
GSAP · Zustand · TanStack Query. A cinema-dark, motion-heavy "Spotify × Letterboxd" UI.

```
src/
  app/          ← routes (folder path = URL; cannot be reorganised into feature folders)
    (auth)/       login, signup
    (main)/       home, discover, film/[slug], slates, circles, community, tribe,
                  artists, festivals, releases, parties, profile, search, settings, …
    onboarding/   the 8-step first-run flow
  components/   ← reusable UI, ALREADY organised by feature (see each folder's README)
  lib/          ← shared client helpers (api client, hooks, formatters, design tokens)
```

## Why `app/` isn't a feature-folder tree
In the App Router, a folder's path **is** its URL and `(auth)`/`(main)` are route groups.
Moving a `page.tsx` changes or breaks its route, so pages stay where routing needs them.
The feature grouping the backend uses lives here in **`components/`** instead — each feature
area (discover, feed, film, match-cut, community, taste-engine, onboarding, slates, …) is its
own folder with a README describing its components.

## Where things live
- **A page** → `app/(main)/<route>/page.tsx`, composed from `components/<feature>/*`.
- **A reusable piece of UI** → `components/<feature>/` (or `components/ui/` for primitives).
- **Data fetching / shared logic** → `lib/` (see [`lib/README.md`](lib/README.md)).

## Conventions
- Framer Motion for component enter/exit, gesture, and layout; GSAP for choreographed,
  timeline-based motion (hero poster fan, taste-engine constellation, onboarding reveals).
- Colour-coded pill chips: mood=amber, genre=green, language=tan, platform=purple, era=violet.
- Mobile + web parity: touch targets ≥44px, no hover-only affordances.
