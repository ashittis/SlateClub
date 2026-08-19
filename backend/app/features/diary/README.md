# diary — one row per viewing

The centre of Kaset. `log → rate → review` all happen in one request here,
because that is how the user experiences it.

## The model

A diary entry is a **viewing**, not a film. There is deliberately no unique
constraint on (user, film): watching Interstellar in 2024 and again in 2026 is
two rows, both preserved forever. Nothing ever overwrites an earlier viewing.

    film · date · rating · liked · review · watch type · rewatch · theatre
    · tags · created

`rating` on the entry is the snapshot from *that* viewing; the user's current
opinion lives in `ratings`. The two legitimately diverge — 3 stars in 2024 and 5
on rewatch — and the diary must keep showing what you thought at the time.

`liked` follows the same logic on a different axis. Affection is not quality: a
3-star comfort rewatch can still be loved, and loving the rewatch but not the
first viewing is a real thing the diary should be able to show honestly. So it
hangs off the viewing, not the film.

`tags` is a plain text array, normalised by `diary_service.normalise_tags`
(lowercased, trimmed, de-duplicated, capped at 8 × 32 chars) rather than by any
route — the log panel and the CSV importer come through the same door. V1
displays tags but does not query by them; a join table would be structure bought
for a feature that does not exist yet.

`watched_on` is a **date**, not a timestamp. A viewing belongs to a day; storing
an instant meant a late-night log could land on tomorrow.

Theatre details (`theatre_name`, `theatre_city`, `theatre_format`) are
denormalised onto the row. V1 keeps this simple — a theatre visit is the memory
of a place, not a foreign key that has to stay canonical.

The log panel **no longer collects them**: picking Theatre records that you
went, and asking for a cinema's name, city and format afterwards turned a
two-tap action into paperwork. The columns remain, and are still written by the
Letterboxd importer and carried by older entries, so the API keeps accepting
them.

## Endpoints
- `POST /api/diary` — log a viewing, optionally with rating and review
- `GET  /api/diary?year=` — the caller's own viewings, private ones included
- `PATCH`/`DELETE /api/diary/{entry_id}`

## Writes go through diary_service

`shared/services/diary_service` is the **single writer** for diary_entries,
ratings, reviews and watch_history. No route touches those directly. Two rules
live there that are easy to get wrong anywhere else:

- Logging an *older* viewing must not drag "last watched" backwards.
- Deleting a viewing **resyncs** the summary from what remains, rather than
  patching it — otherwise removing the newest viewing leaves a stale date.
