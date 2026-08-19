# watchlists — named, curated collections

A list the user made on purpose: "1970s paranoia", "Films to watch with Dad".

**Distinct from the single implicit watchlist** (`/api/watchlist`), which is the
"save this for later" button. Conflating them would mean adding a film to a
themed list also marked it as something you intend to watch next — which isn't
true, and would quietly corrupt the watchlist's meaning.

## Order is the content

A curated list is ordered on purpose, so `position` is stored rather than
derived, and two rules protect it:

- **Removing a film closes the gap.** Holes in the ordering make later reordering
  behave unpredictably.
- **Reorder takes the whole order**, not a move instruction — that keeps
  drag-and-drop idempotent. Films the client didn't mention keep their relative
  order at the end, so a stale client can't silently drop them from the list.

## What SlateClub's "Slates" had that this doesn't

Collaborators, likes, saves, and a per-slate chat room. Those made a slate a
small social space; a Kaset list is a list. Sharing is a public URL.
