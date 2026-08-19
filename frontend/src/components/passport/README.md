# passport — the cinematic identity surface

- **`PassportView.tsx`** — the whole passport. One component for both "mine" and
  "theirs": the backend returns one shape and enforces privacy, so this renders
  what it's given and only branches on ownership for editing affordances.
- **`StatGrid.tsx`** — the centrepiece. A ruled grid of monospace figures rather
  than cards, because this is a record and the early-2000s treatment is a table,
  not a dashboard.

Laid out as a document: identity block, stat table, then collections. The stats
*are* the identity here — that's the difference between a Passport and a profile.

`films` and `viewings` always appear as separate figures. They diverge on every
rewatch, and showing only one of them would misrepresent the year.
