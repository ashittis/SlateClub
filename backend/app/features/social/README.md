# social — following, activity, and messages

Kaset's social layer is deliberately small (KASET.md §8). You follow people, you
see what they logged, and you can message them about a film. There are no likes,
no comments, no reshares — it is a cinema record shared with people, not a
general social network.

## Files
- **`follows.py`** — one-directional follows. No friend-request handshake;
  SlateClub's "orbit" (a mutual-follow handshake) is gone.
- **`activity.py`** — the feed, derived **live** from the source tables rather
  than a stored event log, so it can never disagree with the diary. Private
  viewings are filtered out server-side.
- **`messages.py`** — direct messages.

## One messaging model

SlateClub ran three: threaded `chat_*` DMs, one-shot `film_dms` (a film plus a
fixed-vocabulary reaction, with no reply), and two group chats. Sharing a film
and talking about it were different tables, so a recommendation was a dead end.

Kaset has one. **A shared film is a message** (`shared_movie_id`), so it lands in
the thread in order and can be replied to. `film_dms` rows were merged into
conversations by migration `0005`, not dropped.

Conversation pairs are stored canonically via `Conversation.pair()` — the old
table left ordering to the caller, which made its unique constraint decorative
and allowed both (A,B) and (B,A) to exist.

## A note on timestamps

The activity feed merges sources with different time types: the diary stores a
calendar `date`, everything else a timestamp. `_as_datetime` levels them in one
place — mixing them breaks both the event id and the merge sort.
