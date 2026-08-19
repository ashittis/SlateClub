# brand — the Kaset mark

- **`Logo.tsx`** — a cassette shell: two hubs in a rounded case, drawn in
  `currentColor` so it inherits ink. Also exports `Wordmark` (mark + KASET).

The same mark exists in three places and they must not drift: this component,
`app/icon.svg` (the favicon), and `public/logo-badge.svg`. Change one, change
all three.
