# match-cut components — the taste-blend UI

The screens for the "Match Cut" blend: invite friends and view the grid of films at the
intersection of your tastes.

## Components
- **`BlendInvite.tsx`** — invite a friend (or group) into a blend session.
- **`FriendMultiPicker.tsx`** — multi-select picker for choosing who to blend with.
- **`MatchCutGrid.tsx`** — the resulting grid of blended film recommendations.

## Notes
- The picker uses large touch targets and avatar chips; the grid animates in as matches
  resolve (Framer Motion stagger).
- Calls the match-cut endpoints (create session, invite, fetch blend).
