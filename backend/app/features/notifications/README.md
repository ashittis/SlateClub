# notifications — the user's alert inbox

The read side of notifications: listing, marking read, and unread counts. The *write* side
(creating notifications) lives in `shared/services/notify`, which every feature calls.

## Files
- **`routes.py`** — list notifications, mark one/all read, unread badge count.
- **`models.py`** — `Notification` (+ the `NOTIFICATION_KINDS` constant enumerating the
  types: follow, reply, dm, orbit request, slate invite, …).

## How it works
1. Any feature that needs to alert a user calls `shared/services/notify.create(...)`, which
   inserts a `Notification` of a given kind.
2. This slice just reads that table for the current user and manages read state.

## Talks to
- shared models: `user`; own model: `notifications`
- paired with: `shared/services/notify` (the writer)
