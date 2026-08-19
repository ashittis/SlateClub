# reviews — writing about a film

A review belongs to the viewing that prompted it: user, film, diary entry,
rating, text (KASET.md §8). `diary_entries.review_id` and `reviews.diary_entry_id`
point at each other, both `SET NULL` — deleting either must not destroy the other.
The viewing happened whether or not the writing survives, and vice versa.

**One review per (user, film).** Rewriting after a rewatch updates the same row
and re-points it at the newer viewing, rather than stacking duplicate reviews
from one person on a single film page.

## Endpoints
- `POST /api/reviews` — write or rewrite
- `GET  /api/reviews/mine` — the Library's Reviews tab
- `GET  /api/reviews/film/{movie_id}` — community reviews, most helpful first
- `DELETE /api/reviews/{id}` · `POST /api/reviews/{id}/helpful`

Every response carries the author's rating alongside the text — a review reads
very differently next to the score it came with.

Writes go through `diary_service.upsert_review` so the diary link is maintained
in one place.
