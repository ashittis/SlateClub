# calibration components — sharpening the taste model

Lightweight prompts that ask the user to compare or rate, feeding the recommendation model
better signal (used during onboarding and periodically after).

## Components
- **`PairwisePicker.tsx`** — "which of these two do you prefer?" pairwise comparison.
- **`AccuracyRating.tsx`** — rate how accurate a recommendation was (did we get it right?).

## Notes
- Both are quick, tap-only interactions with satisfying micro-animations (Framer Motion).
- Responses post to the calibration/feedback endpoints (`CalibrationResponse` / micro-feedback).
