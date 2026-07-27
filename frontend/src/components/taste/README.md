# Taste components — surfacing the taste engine's read on you

These small, self-fetching components translate the recommendation engine's output into plain-language identity cues: your "cinematic identity," which taste tribe you belong to, and a nudge when your taste is drifting. They're dropped onto the home/profile/taste pages as standalone widgets.

## Components
- **`TasteIdentityCard.tsx`** — your "Cinematic Identity" panel: a genre-blend headline, animated strength bars for your primary taste axes, a written taste statement, top director/artist affinities, and tribe pills. Reads `/api/taste/identity`.
- **`TribeLabel.tsx`** — a compact green pill showing your assigned taste tribe and its member count, linking to `/tribe`. Reads `/api/tribes/my-tribe`; renders nothing if you have no tribe yet.
- **`TasteDriftBanner.tsx`** — a dismissible-style banner that appears only when the engine detects a "phase transition" in your taste, showing a drift score and a link to update preferences. Reads `/api/taste/drift`, re-checking every 5 minutes.

## Notes
Each component fetches its own data with TanStack Query and self-hides when there's nothing to show, so pages can include them unconditionally. Motion is used for meaning: identity axis bars grow from 0 with `easeOut`, and the drift banner expands via an `AnimatePresence` height animation. Tribe pills reuse the shared `Pill` (green). The green accent signals "positive/insight" here per the palette.
