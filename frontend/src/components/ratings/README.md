# Ratings components — the signature star widget

This folder holds SlateClub's star-rating control, used everywhere a title (or season) can be scored. It supports quarter-star precision and an animated, gradient fill that reads as a premium, tactile rating gesture.

## Components
- **`StarRating.tsx`** — a 5-star rating from 0 to 5 in quarter-star steps. Drag, tap, or use arrow keys to set a value; tapping the current value clears it. A shared amber→crimson gradient fills left-to-right across all five stars, and rating up triggers a staggered "pop." Has a `readonly` mode for display and four sizes (`sm`–`xl`).

## Notes
The fill is a single SVG gradient revealed by a clip rect that GSAP animates (fast while dragging, a smooth flow when committed) — React never fights GSAP for the width. Fully accessible: `role="slider"` with `aria-valuenow`/`aria-valuetext` and keyboard support. Honours `prefers-reduced-motion` (snaps instead of animating). Touch-first: the `xl` size keeps each star ≥44px so quarter-zones stay tappable, and `touchAction: none` prevents scroll-hijacking during a drag. Pure UI — the parent decides what to do with `onChange`.
