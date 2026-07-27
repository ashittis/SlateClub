# Onboarding components — the multi-step "learn your taste" flow

These are the building blocks for SlateClub's onboarding wizard. They give every step a consistent frame (title, body, progress dots, sticky Next button) so the flow feels like one continuous, guided reveal instead of a stack of forms.

## Components
- **`StepShell.tsx`** — the shared scaffold for every step: animated title + subtitle, a body slot, and a footer that sticks to the bottom on mobile. Fades and slides its content up on mount.
- **`OnboardingProgress.tsx`** — the thin row of progress dots/bars at the top ("Step 3 of 8"). Completed and active segments light up amber; upcoming ones stay dim.
- **`MoodSlider.tsx`** — a single two-pole slider (e.g. calm ↔ intense). The glowing thumb and the active side's label brighten as you drag; centre means "haven't decided." Works with mouse and touch.
- **`NextButton.tsx`** — the full-width advance button. Disabled until the step is valid, shows a spinner + "Saving…" while submitting, and has a warm gradient glow when active.

## Notes
All four are Framer Motion powered — subtle opacity/y fades on mount, spring physics on the slider thumb, hover/tap scale on the button. Amber (`--cta-primary`) is the throughline accent. Built mobile-first: the footer is sticky on small screens, the slider is drag-friendly with large touch targets, and the layout centres to a `max-w-3xl` column on desktop. These are presentational pieces; the parent step pages own the data and API calls.
