# notifications components — the alert row

Rendering of a single notification in the inbox list.

## Components
- **`NotificationItem.tsx`** — one notification row: icon by kind (follow, reply, dm, orbit,
  slate invite…), actor, text, and read state.

## Notes
- Tapping marks it read and deep-links to the target; unread items are visually emphasised.
- Reads from the `notifications` endpoints.
