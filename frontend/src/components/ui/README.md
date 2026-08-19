# UI components — shared primitives and the visual grammar

The building blocks other folders lean on: `Button`, `Modal`, `Avatar`,
`Skeleton`.

## The grammar

Structure comes from **1px hairline rules** (`--rule`), never shadows, glows or
rounded pills — a rounded control reads as a different design system. Surfaces
are paper, text is ink, and exactly one accent — oxide red `--tape` — marks the
primary action on a screen. **If two things on a page are filled with `--tape`,
one of them is wrong.**

Metadata (dates, runtimes, counts, ratings) is always monospace via `.meta`;
section headers use `.section-label`. That grotesk/mono split is what carries
the cassette-label feel without tipping into costume.

Every interactive control clears 44px so it stays tappable wherever it lands.

## Colour lives in two files

`app/globals.css` and its TS mirror `lib/design-tokens.ts`. Never inline a hex —
the auth screens carried an orange gradient and a hard-coded white for most of
the rebase precisely because it was easy not to notice.
