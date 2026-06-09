This is actually a much better UX than separate Movie and Series sections.

Spotify's search works because users don't think:

> "I want a song result now, then an album result."

They think:

> "Show me the most relevant thing."

Slate should work the same way.

---

# Prompt for Claude Code

Redesign the Slate search experience to behave like Spotify search.

Current behavior:

Movies

* Result 1
* Result 2

Series

* Result 1
* Result 2

This must be removed.

---

NEW SEARCH MODEL

Use a single mixed result feed.

Movies and Series should appear together in one ranked list.

Results are sorted purely by relevance score.

Example:

Search:
Breaking

Results:

Breaking Bad
Series • 5 Seasons

Breaking Away
Film • 1979

Breaking Surface
Film • 2020

Breaking Bad: El Camino
Film • 2019

Breaking Point
Series • 2 Seasons

Do NOT separate into sections.

---

LAYOUT

Follow Spotify search result layout almost exactly.

Each row:

[Poster]

Title

Secondary metadata line

Actions

---

POSTER

Left side.

Aspect ratio:

2:3 poster ratio.

Rounded corners.

48-56px width.

---

TITLE

Large bold text.

Examples:

Breaking Bad

Interstellar

The Bear

---

METADATA LINE

Exactly where Spotify shows:

Song • Artist

or

Album • Artist

Slate should show:

Film • 2014

Series • 5 Seasons

Series • 3 Seasons • Ongoing

Film • 2h 49m

Examples:

Interstellar
Film • 2014

Breaking Bad
Series • 5 Seasons

The Bear
Series • 3 Seasons

---

ACTION ICON

Right side.

Replace Spotify "+" icon.

Use:

* Slate

icon.

Behavior:

Tap

Opens:

Add To Slate sheet.

Shows:

My Slates

Create New Slate

---

CHECKMARK

If already inside a Slate:

Show checkmark.

Exactly like Spotify.

---

SEARCH RANKING

Do NOT rank separately.

Movies and Series should compete in the same ranking pool.

Example:

Search:
Office

1. The Office (US)
2. The Office (UK)
3. Office Space
4. Corner Office
5. The Office Party

Mixed results.

---

SEARCH SCORING

Score should combine:

Exact title match

Popularity

User taste relevance

Community activity

Recency

Then sort descending.

---

SEARCH PAGE STATES

No search:

Show:

Recent Searches

Recently Viewed

Popular in Orbit

---

Recent Search Row

Same layout.

Poster
Title
Metadata

Right side:

X

to remove from history.

---

RESULT ROW INTERACTION

Tap row:

Navigate directly to:

/film/[slug]

or

/series/[slug]

based on media_type.

---

VISUAL STYLE

Match Spotify's density.

Compact rows.

Fast scanning.

Minimal visual noise.

Avoid cards.

Avoid grids.

Avoid separate Movie/Series blocks.

The search page should feel like:

Spotify Search
+
IMDb precision
+
Slate branding.

The user should immediately find the most relevant title regardless of whether it is a movie or a TV series.

---

### One improvement beyond Spotify

For Slate, I'd add a tiny badge beside the metadata:

```text
Breaking Bad
Series • 5 Seasons
94% Match
```

or

```text
Interstellar
Film • 2014
89% Match
```

in muted orange.

That immediately tells the user:

> "Not only did I find it, but Slate thinks I'll like it."

which reinforces your taste-engine advantage over Letterboxd.
