# Social components — following, reviews, and taste-matching

These power SlateClub's social layer: activity feeds of what people are watching, follow/"orbit" relationship buttons, review writing and display, critic badges, and the taste-compatibility cards that compare two users' taste vectors.

## Components
- **`ActivityFeed.tsx`** — a poster grid of friends' activity. Merges events per (person, film) so a rated + reviewed film shows one card (stars + a hand-drawn review glyph) instead of duplicates. Shelving/follows are filtered out.
- **`FollowButton.tsx`** — simple optimistic Follow / Following toggle backed by `/api/follows/:id`.
- **`OrbitButton.tsx`** — the mutual-friend ("orbit") request control: cycles through Add to Orbit → Requested → Accept → Orbiting based on `/api/orbits/status/:id`, invalidating notifications on change.
- **`ReviewCard.tsx`** — a single review: avatar, @username, relative time, spoiler tag (blurred text you tap to reveal), helpful count, and comment count.
- **`ReviewForm.tsx`** — the compose box: 500-char textarea, "contains spoilers" checkbox, and submit. Posts through the social store.
- **`TasteMatchCard.tsx`** — the "Match Cut" panel: cosine-match %, films you both love, films you'd argue about, and a "Plan a movie night" link. Strong matches (≥70%) get an amber glow.
- **`TwinBadge.tsx`** — a compact circular "Taste twin" % badge; ≥70% glows amber, below stays muted.
- **`CriticBadge.tsx`** — a small ✦ Critic badge that only renders if the user currently clears the algorithmic critic threshold (`/api/critics/check/:username`).

## Notes
Follow/orbit buttons update optimistically and reconcile via TanStack Query invalidation. Match/twin components brighten with score to reward strong compatibility. Icons are hand-crafted SVGs (review pen glyph), not an icon pack, per the design rules. Framer Motion adds gentle scale/fade entrances on the badges and match card. Reviews and follows go through a shared Zustand `socialStore`; taste/critic/orbit data comes straight from the API via queries.
