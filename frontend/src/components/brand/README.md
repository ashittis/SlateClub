# brand

Brand identity primitives shared across the app.

- **`Logo.tsx`** — the SlateClub circular badge ("SLATECLUB · SLATECLUB" stamp
  with two coral sparkles). Inline SVG so the ring text inherits `currentColor`
  (set it via the parent's text color) and the sparkles use the `--cta-primary`
  token. Scale with the `size` prop. Used in the top nav, auth shell, onboarding
  header, and the onboarding "ready" hero.

The same artwork also lives as static assets for non-component use:
- `public/logo-badge.svg` — standalone file (e.g. share images, external embeds).
- `app/icon.svg` — browser-tab favicon (theme-aware fill, hard-coded colors).

When updating the mark, keep all three in sync.
