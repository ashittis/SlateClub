# src — the Kaset frontend

Next.js App Router. Folders under `app/` map to URLs; the feature grouping
lives in `components/<feature>/`. Read `KASET.md` at the repo root first.

```
app/
  layout.tsx      SERVER component — owns metadata/OG/favicon. Keep it server-side.
  providers.tsx   the client boundary (QueryClient + auth bootstrap)
  globals.css     the design tokens. The only place colour is defined.
  (auth)/         login · signup
  onboarding/     the cold-start flow
  (main)/         the signed-in app
components/       one folder per feature, each with a README
lib/
  api/            typed domain modules — the ONLY way to reach the backend
  nav.ts          the four primary items, for both surfaces
  design-tokens.ts  TS mirror of globals.css, for JS/SVG/canvas only
stores/           Zustand: auth · onboarding
```

## Rules
- Never inline an endpoint string in a component. Add it to a `lib/api/` module.
- Never inline a hex. Use the CSS variables or Tailwind classes.
- `app/layout.tsx` must stay a server component — making it `"use client"`
  silently forfeits every OG, Twitter and manifest tag.
- Mobile and desktop ship together. Touch targets ≥44px, no hover-only
  affordances. Check at 390×844 before calling anything done.
- Framer Motion for component enter/exit and gestures; GSAP only for real
  multi-element timelines. Honour `prefers-reduced-motion`.
