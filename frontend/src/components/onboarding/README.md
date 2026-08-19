# onboarding — the five-step wizard

Shared chrome for `app/onboarding/*`. The flow itself (order, labels, hrefs) is
defined once in `lib/api/onboarding.ts` as `ONBOARDING_STEPS` — the layout and
the progress bar both read it, so adding or reordering a step is a one-line change.

- **`StepShell.tsx`** — title, body, and a footer that sticks to the bottom on
  mobile so the primary action stays in thumb reach.
- **`NextButton.tsx`** — primary action plus an optional Skip. Skip is a real
  button, not a grey link: only step 1 is required and the UI should say so.
- **`PickerSearch.tsx`** — debounced search + result rows, generic over the item,
  shared by the films and cast/crew steps.
- **`OnboardingProgress.tsx`** — tape-counter segments rather than a loading bar.

SlateClub's `MoodSlider` is gone with the mood step; the taste vector it fed no
longer exists.
