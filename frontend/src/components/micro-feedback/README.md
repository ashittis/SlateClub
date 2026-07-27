# micro-feedback components — the always-present thumbs

The tiny, low-friction feedback control shown on cards so users can nudge their
recommendations without a full rating.

## Components
- **`MicroFeedbackBar.tsx`** — the compact thumbs-up/down (or more/less) bar attached to a
  film card.

## Notes
- One-tap, optimistic; the signal tunes the recommendation engine immediately.
- Posts to the `feedback` endpoint (writes `MicroFeedback`).
