# texture — the zine surface

Four primitives that carry the Y2K/print aesthetic. Built once, used everywhere.

- **`Grain.tsx`** — one `feTurbulence` layer, mounted once in the root layout and
  fixed to the viewport. Deliberately *not* per-component: a hundred grain layers
  is a hundred composited surfaces and scrolling pays for every one.
- **`Duotone.tsx`** — washes an image in its genre colour, pure CSS. For
  **editorial imagery only** — backdrops, share cards, match reveals. Never for
  poster thumbnails: washing those makes films unrecognisable at 96px, and
  posters are the content.
- **`Halftone.tsx`** — newspaper dot screen for hero blocks and loading states.
- **`Scanlines.tsx`** — CRT lines plus a drifting tracking bar. The loudest thing
  in the system, scoped to the VHS chrome around logging.

## The rule that keeps this readable

**Texture never sits under body text.** Grain and halftone apply to imagery and
display type ≥18px. Anything smaller sits on flat `--void` or `--soot` and clears
4.5:1. The aesthetic is worth nothing if the diary can't be read.

## Motion

Glitch belongs to two *events* — the log capture and a blend match reveal — and
is never ambient. `prefers-reduced-motion` removes the tracking bar and every
animation while leaving the static textures intact.
