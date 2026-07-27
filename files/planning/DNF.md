Yes. The Reddit user is actually asking for **memory**, not just notes.

The problem with most watchlists is:

```text
Movie Added
↓
3 months pass
↓
Why the hell did I add this?
```

For Slate, I'd make it feel much more intentional.

---

# Feature 1: Shelf Notes

When user clicks:

```text
+ Shelf
```

Instead of immediately saving:

### Bottom Sheet

```text
Add to Shelf

Why are you saving this?

○ Recommended by a friend
○ Recommended by Slate
○ Saw on social media
○ Heard good things
○ Similar to another movie
○ For a specific mood
○ Other

[ Optional note ]

________________________

Save
```

---

This is much faster than forcing text entry.

Most users won't type.

---

# If they choose Similar to another movie

Show:

```text
Saved because:

[ Soorarai Pottru ]
```

Store:

```json
{
  "source":"similar_movie",
  "source_movie":"Soorarai Pottru"
}
```

---

# If they choose Recommended by Slate

Store:

```json
{
  "source":"slate_recommendation",
  "recommendation_surface":"discover"
}
```

Now later you can show:

```text
Added because Slate matched it to
Soorarai Pottru (92%)
```

---

# Profile Page Improvement

Current:

```text
Poster
Title
```

Instead:

```text
Poster

Maa Behen

Saved because:
Similar to Lapata Ladies

Added 3 weeks ago
```

Very small grey text.

Not intrusive.

---

# Even Better

Show on hover/tap:

```text
ⓘ
```

Click:

```text
Added because:
Recommended by Rahul

Notes:
"Looks like a fun comedy"
```

---

# Database

Add:

```sql
shelf_entries
```

```sql
id
user_id
movie_id

reason_type
reason_reference

note

added_at
```

Example:

```sql
reason_type
----------------
friend
slate
social_media
similar_movie
custom
```

---

# Feature 2: Currently Watching

This one is huge.

Letterboxd should have had it years ago.

---

Instead of:

```text
Watchlist
Watched
```

Add:

```text
Shelf
Watching
Watched
DNF
```

---

# Workflow

Movie page:

Current:

```text
Shelf
Watched
```

Replace with:

```text
Shelf
Start Watching
Watched
```

---

When user clicks:

```text
Start Watching
```

Movie moves to:

```text
Watching
```

---

Display:

```text
Currently Watching

Iron Lung

Started:
June 9

Progress:
45%
```

---

# For users who don't track progress

Simple version:

```text
Started 2 days ago
```

---

# Feature 3: DNF

This is actually more valuable than ratings.

Current options:

```text
Watched
```

---

Add:

```text
Mark as DNF
```

or

```text
Didn't Finish
```

---

Bottom Sheet:

```text
Stopped watching at:

○ 15 min
○ 30 min
○ 1 hour
○ Near the end

Reason?

○ Too slow
○ Didn't enjoy
○ Not in the mood
○ Bad recommendation
○ Other
```

---

Store:

```json
{
  "movie":"Iron Lung",
  "status":"dnf",
  "reason":"too_slow",
  "progress":35
}
```

---

This becomes amazing recommendation data.

If a user DNF's:

```text
Slow cinema
Slow cinema
Slow cinema
```

Slate learns instantly.

---

# Better Shelf UI

Current profile:

```text
Shelf
```

I'd split it:

```text
Shelf (12)
Watching (2)
DNF (5)
Watched (140)
```

---

# Best UX Flow

For your existing UI:

### Click "+ Shelf"

Open:

```text
Add to Shelf

Optional:
Why are you saving this?

[______________]

Save
Skip
```

If user presses:

```text
Save
```

Store note.

If:

```text
Skip
```

Add normally.

---

### Profile Card

Show:

```text
Maa Behen

Saved because:
Looks like Lapata Ladies
```

Only first line.

Click card for full note.

---

### Add New Shelf Filter

```text
All
Notes
Watching
DNF
```

---

If I were prioritizing:

### Must Build

✅ Shelf Notes

✅ DNF

### Build Next

✅ Currently Watching

Because Shelf Notes and DNF immediately improve Slate's recommendation engine, while Currently Watching is mostly a user experience improvement.
