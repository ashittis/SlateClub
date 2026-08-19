# layout — the app shell

The persistent frame around every signed-in page. **One horizontal bar, no
vertical rail.**

The rail is gone deliberately. It spent 240px — a sixth of a laptop screen — on
four words that never changed, in a product whose content is posters. Everything
it carried moved into the top bar and the space went back to the film grid.

- **`TopBar.tsx`** — the whole desktop chrome: wordmark, primary nav, search
  field, Messages, Notifications, Create, avatar. Composes the four below.
- **`SearchField.tsx`** — the persistent search pill. Submits to `/search?q=…`;
  it does *not* search as you type, because the search page owns the live query
  and two things racing over one URL is a bug waiting to happen.
- **`CreateMenu.tsx`** — the filled `+ Create` button and its menu: Log a film ·
  New watchlist · New blend. The only filled control in the bar.
- **`AccountMenu.tsx`** — the avatar, and the only route to the Passport.
- **`MobileTabBar.tsx`** — all four primary items as a bottom bar.
- **`Page.tsx`** — the content well (`Page`, `PageHeader`, `Section`). Every page
  under `(main)` opens with one of these instead of hand-writing `mx-auto
  max-w-3xl px-4 lg:px-8` for the nineteenth time.
- **`useMenu.ts`** — outside-click and Escape for the two dropdowns.
- **`navIcons.tsx`** — hand-drawn 1.5px geometry, `currentColor`. No icon pack.

## The four items

`lib/nav.ts` is still the single source of truth: Home, Search, Your Library,
Create. Desktop renders the first three inline and **Create as a button**,
because the other three are places you go and Create is a thing you start.
Mobile keeps all four in the bottom bar, where the tab bar *is* the navigation
and a hidden fourth item would simply be lost.

If you want a fifth item, the feature almost certainly belongs inside one of the
four.

## Active state

A 2px `--blood` rule along the live item — under it in the top bar, over it in
the tab bar. Both surfaces previously inverted to a solid `--bleach` block,
which in a horizontal bar reads as a pressed button rather than a location. The
one inverted, filled thing in the chrome is `+ Create`.

## Widths

`Page` defaults to `max-w-[1100px]`; pass `width="narrow"` for prose and forms,
where a long measure hurts reading. Those are the only two options on purpose.
