# UI components — shared primitives and the visual "grammar"

The reusable building blocks every other folder leans on: buttons, pills, modals, skeletons, poster collages, and the ambient/atmospheric layers that give SlateClub its cinema-dark, film-projector feel. If a piece of UI appears in more than one place, it usually lives here.

## Components
- **`Pill.tsx`** — the colour-coded chip that is the app's silent grammar: mood=amber, genre=green, language=tan, platform=purple, era=violet, neutral=graphite. Active = saturated fill, idle = subtle tint + stroke. Renders as a button or span.
- **`ColorChipLegend.tsx`** — a one-line key that spells out the pill colour taxonomy, surfaced once (e.g. in Settings) so users can learn the code.
- **`Button.tsx`** — the base button with `primary` / `secondary` / `ghost` / `danger` variants and three sizes; primary carries the amber CTA gradient + glow. Forwards refs.
- **`Modal.tsx`** — centered dialog with a blurred backdrop, spring pop-in, Escape-to-close, body-scroll lock, and an optional titled header. Powered by `AnimatePresence`.
- **`CardStack.tsx`** — fanned/mosaic/spiral poster collage used by home hero, onboarding, and slate covers. Posters animate in with staggered spring reveals.
- **`AmbientBackdrop.tsx`** — samples a poster's dominant colour and bleeds it as a soft radial gradient behind the page (home hero, film detail); morphs when the poster changes.
- **`AmbientGlow.tsx`** — a layered "shader" lighting effect (radial core, masked sunset column, ribbed light, heavy vignette) that GSAP slowly drifts, so warm light appears to emerge from darkness. Static under reduced motion.
- **`ShaderAnimation.tsx`** — a live WebGL (Three.js) radial line-burst tinted to the brand ramp (crimson→rust→amber), like a projector flare. Self-animates; GSAP fades it in; renders null if WebGL is unavailable.
- **`FilmGrain.tsx`** — a cheap, static filmic-noise overlay (SVG `feTurbulence`, desaturated) that adds subtle grain on close inspection.
- **`RankedOverlay.tsx`** — the big outlined editorial numeral (1, 2, 3…) overlaid on Trending posters, styled like a magazine layout rather than a badge.
- **`Skeleton.tsx`** — a minimal pulsing placeholder block for loading states.
- **`Avatar.tsx`** — the one true circular avatar (image or initial fallback on a CTA fill).
  Replaces the ad-hoc "first initial" markup that was duplicated across the app.
- **`UserChip.tsx`** — avatar + name (+ optional @handle / meta) row; links to the profile.
  The shared "Avatar + name row" used in People results, comments, and lists.
- **`FeedRow.tsx`** — a titled horizontal-scroll rail (standardises the `no-scrollbar` track used
  across Home and Film Detail).
- **`ProgressBar.tsx`** — thin "% watched" bar shared by `ProgressPosterCard` and the Continue
  Watching bar.

## Notes
These honour the design system's core rules: hand-crafted icons/effects over clip-art, GSAP for drifting/timeline atmosphere (`AmbientGlow`, `ShaderAnimation`), Framer Motion for component transitions (`Modal`, `CardStack`), and CSS-only cheap effects (`FilmGrain`, `RankedOverlay`). Pill colours come from `@/lib/design-tokens`. Motion-heavy pieces respect `prefers-reduced-motion` and heavy 3D/WebGL degrades gracefully. All are theme-token driven (`--bg-*`, `--text-*`, `--cta-*`), so they stay consistent across the app.
