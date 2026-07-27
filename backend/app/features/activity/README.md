# activity — the friends' activity feed

The "what people you follow have been doing" feed: recent ratings, reviews, watches, and
list activity from a user's social graph.

## Files
- **`routes.py`** — returns a chronological feed of `ActivityEvent`s from the people the
  current user follows, hydrated with the relevant film and actor.

## How it works
1. Actions elsewhere (rating, reviewing, adding to a slate) emit an `ActivityEvent`
   (in shared `social`).
2. This route reads those events filtered to the user's `Follow` graph, joins in the
   `Movie` and author `User`, and returns them newest-first.

## Talks to
- shared models: `social` (ActivityEvent, Follow), `actions`, `movie`, `user`
