# social — following, activity, and reviews

- **`ActivityFeed.tsx`** — what the people you follow have been watching.
- **`FollowButton.tsx`** — follow / unfollow.
- **`ReviewCard.tsx`**, **`ReviewForm.tsx`** — reading and writing reviews.

Removed in the rebase: `OrbitButton` (SlateClub's mutual-follow handshake —
Kaset uses plain one-directional follows), plus `CriticBadge`, `TwinBadge` and
`TasteMatchCard`, all computed from the 25-dimensional taste vector that no
longer exists.

Sharing a film lives in `components/film/ShareFilmSheet.tsx`, because it starts
from a film, not from a person.
