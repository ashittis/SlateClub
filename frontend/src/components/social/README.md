# social — following, activity, and reviews

- **`FriendActivityCard.tsx`** — one friend's viewing, as a poster. The home
  feed's signature element: artwork leads, the person is a chip along its foot,
  the rating and date sit underneath in mono. It replaced a line of text —
  "Priya rated Rang De Basanti" — which read as a changelog of other people's
  admin rather than a reason to stop scrolling. Two stacked links, never nested:
  the poster goes to the film, the chip goes to the person.
- **`ActivityFeed.tsx`** — what the people you follow have been watching.
- **`FollowButton.tsx`** — follow / unfollow.
- **`ReviewCard.tsx`**, **`ReviewForm.tsx`** — reading and writing reviews. Both
  were still wearing SlateClub's Tailwind theme (`bg-glass-6`, `accent-green`,
  `text-text-primary`), none of which survived the rebase — every one of those
  classes resolved to nothing, so the components rendered unstyled. Rebuilt on
  Kaset tokens.

Removed in the rebase: `OrbitButton` (SlateClub's mutual-follow handshake —
Kaset uses plain one-directional follows), plus `CriticBadge`, `TwinBadge` and
`TasteMatchCard`, all computed from the 25-dimensional taste vector that no
longer exists.

Sharing a film lives in `components/film/ShareFilmSheet.tsx`, because it starts
from a film, not from a person.
