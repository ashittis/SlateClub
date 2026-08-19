# layout — the app shell

The persistent frame around every signed-in page.

- **`LeftRail.tsx`** — desktop navigation. The four primary items, active one
  marked with a solid left bar (a rule, not a glow — this is a paper UI).
- **`MobileTabBar.tsx`** — the same four items as a bottom bar. Not a reduced
  version of the rail; the same mental model on a phone.
- **`TopNav.tsx`** — the secondary destinations that must be reachable from
  anywhere: Messages, Notifications, and the avatar (the only route to the
  Passport).
- **`navIcons.tsx`** — hand-drawn 1.5px geometry, `currentColor`. No icon pack.

Both nav surfaces read `lib/nav.ts`. There are exactly four primary items —
Home, Search, Your Library, Create. If you want to add a fifth, the feature
almost certainly belongs inside one of the four.
