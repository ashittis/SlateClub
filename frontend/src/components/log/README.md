# log — recording a viewing

One log surface, mounted once in `app/(main)/layout.tsx`, opened from anywhere
through `stores/logStore.ts`. Three call sites drive it: the top bar's Create
menu, the film page, and a poster's quick actions.

- **`LogDialog.tsx`** — the shell. A centred dialog on desktop with the poster in
  its own column; a bottom sheet on mobile. Also hosts the film picker when
  opened without a film, and the confirmation after a successful write.
- **`LogForm.tsx`** — the fields, the submit, and the write. Owns its own
  scroll/footer split so the button is always reachable.
- **`LogFilmPicker.tsx`** — step one when logging from outside a film page.
- **`LogConfirmation.tsx`** — the GSAP payoff after a successful log. One of the
  two timelines KASET.md §6 sanctions GSAP for.
- **`LogDateField.tsx`** — mono date over a native `<input type="date">`, plus
  Today / Yesterday.
- **`WatchMethodPicker.tsx`** — Theatre · Streaming · TV · Other, as icons.
- **`LogToggle.tsx`** — one icon toggle. `stack` for the modifier row, `inline`
  for a lone toggle in the form flow.
- **`TagInput.tsx`** — tag chips; Enter or comma commits.
- **`logIcons.tsx`** — hand-drawn SVGs, same rules as `layout/navIcons.tsx`.

## Why this is a dialog

It used to be an inline panel on the film page, and that was a considered
choice: a viewing is something you did to the film you are looking at, and
dropping a scrim over that film to ask about it broke the connection.

The goal was right. The mechanism cost two things. Logging could only start from
a film page, so the single most common action in the product had exactly one
door. And on a wide screen the panel rendered as a narrow column with the poster
scrolled off above it — the exact disconnection it existed to prevent.

The dialog keeps the film in frame by **carrying it**: poster and title sit in
their own column for the whole interaction, whatever page you opened from.

## Rules that shaped it

**Nothing is required beyond the film.** "I watched this" is still two taps.
Date defaults to today *in the viewer's timezone*, and the rewatch toggle
defaults on when a viewing already exists.

**The rating leads.** It is the one field almost everyone sets and the only one
that rewards a gesture, so it sits at the top at `size="xl"` (44px stars, so the
quarter-star zones stay tappable).

**The fast path is the whole visible form.** Rating, date, and the three
modifiers — that is it. Venue, review, spoiler and tags live behind one
*Add review, venue, tags* disclosure. Showing all seven fields at once made a
two-tap action present itself as a form, and people read a form and decide to do
it later. The disclosure summarises what it holds when collapsed and something
is set, so it is never a mystery box.

**The submit is pinned, never scrolled to.** `LogForm` scrolls its fields and
keeps the button in a fixed footer. On a phone this is the difference between
logging a film and abandoning it.

**Modifiers are icon toggles, not checkbox rows.** Liked, rewatch, private and
spoilers each get an icon over a mono caption. Four full-width rows reading
"This was a rewatch" made it look like a tax return. The caption is always
drawn — an icon alone has no accessible name, and a tooltip would be hover-only.

**State is shape, not colour.** A liked viewing fills the heart's own path
rather than turning it red, because the surface spends its single `--blood` fill
on the submit (see `components/ui/README.md`).

**The theatre sub-form is gone.** Choosing Theatre records that you went, and
nothing more. The `theatre_name` / `theatre_city` / `theatre_format` columns
still exist for the Letterboxd importer and for older entries.

## Invalidation

`LogDialog` invalidates what every log touches — the diary and the watchlist.
Anything page-specific is the opener's business, passed as `onLogged` through
the store: the film page invalidates six keys, the top bar none. The dialog does
not guess on the caller's behalf.

It writes through `diaryApi`, never directly — the diary is the single writer
for viewings, and no surface may fabricate one.
