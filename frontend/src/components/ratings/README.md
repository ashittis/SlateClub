# ratings — the star control

- **`StarRating.tsx`** — quarter-star precision, drag and keyboard support,
  `role="slider"`. Used anywhere a film is scored: the film page, the log sheet,
  the diary, the Passport.

On paper a filled star is oxide red (`--tape`) and an empty one is an outlined
hairline — a pale fill alone disappears against `--paper`. At `size="xl"` each
star is ≥44px so the quarter-zones stay tappable.

A rating is an *opinion*, and setting one never creates a diary entry. Logging a
viewing is a separate, deliberate act — see `components/log/`.
