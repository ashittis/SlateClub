# log — recording a viewing

Logging happens **inline on the film page**, not in a modal. A viewing is
something you did to the film you are looking at; dropping a scrim over that
film to ask about it broke the connection, and you ended up filling in a form
about a thing you could no longer see. The panel takes the primary button's
place in the layout, so the page never jumps and the poster stays put.

- **`LogPanel.tsx`** — the panel itself: state, submit, and the swap into the
  confirmation. Mounted by `app/(main)/film/[slug]/page.tsx` in place of the
  "Log this film" button.
- **`LogConfirmation.tsx`** — the GSAP payoff after a successful log. One of the
  two timelines KASET.md §6 sanctions GSAP for.
- **`LogDateField.tsx`** — mono date over a native `<input type="date">`, plus
  Today / Yesterday.
- **`WatchMethodPicker.tsx`** — Theatre · Streaming · TV · Other, as icons.
- **`LogToggle.tsx`** — one icon toggle. `stack` for the modifier row, `inline`
  for a lone toggle in the form flow.
- **`TagInput.tsx`** — tag chips; Enter or comma commits.
- **`logIcons.tsx`** — hand-drawn SVGs, same rules as `layout/navIcons.tsx`.

## Rules that shaped it

**Nothing is required beyond the film.** "I watched this" is still one tap:
open the panel, hit Log it. Date defaults to today *in the viewer's timezone*,
and the rewatch toggle defaults on when a viewing already exists.

**The rating leads.** It is the one field almost everyone sets and the only one
that rewards a gesture, so it sits at the top at `size="xl"` (44px stars, so the
quarter-star zones stay tappable).

**Modifiers are icon toggles, not checkbox rows.** Liked, rewatch, private and
spoilers each get an icon over a mono caption. Four full-width rows reading
"This was a rewatch" made a two-tap action look like a tax return. The caption
is always drawn — an icon alone has no accessible name, and a tooltip would be
hover-only.

**State is shape, not colour.** A liked viewing fills the heart's own path
rather than turning it red, because the film page spends its single `--tape`
fill on the primary action (see `components/ui/README.md`).

**Exactly one tape fill.** The trigger button and the panel occupy the same slot
and are mutually exclusive, so the page never shows two filled controls.

**The page-level star hides while the panel is open.** That star writes the
user's *current* rating; the panel's writes the viewing's snapshot. Two rating
controls a few hundred pixels apart, writing to different tables, is a trap.

**The theatre sub-form is gone.** Choosing Theatre records that you went, and
nothing more. The `theatre_name` / `theatre_city` / `theatre_format` columns
still exist for the Letterboxd importer and for older entries.

It writes through `diaryApi`, never directly — the diary is the single writer
for viewings, and a film page must never fabricate one.
