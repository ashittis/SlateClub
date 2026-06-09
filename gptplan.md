Ah, that's actually much better branding.

If:

```text
SlateClub = The platform
```

and

```text
Slate = A curated collection / playlist
```

then don't call the feature "List" anywhere.

A Slate should become a first-class object in the app, just like:

```text
Spotify -> Playlist
Letterboxd -> List
Pinterest -> Board
```

For SlateClub:

```text
SlateClub -> Slate
```

---

## Mental Model

User says:

```text
I created a Slate.
```

not

```text
I created a list.
```

Examples:

```text
Top 10 Tamil Films
```

is a Slate.

```text
Movies That Made Me Cry
```

is a Slate.

```text
Ashik + Rahul Weekend Watchlist
```

is a Collaborative Slate.

---

## Navigation

Instead of:

```text
Discover
```

having only movies.

Add:

```text
Discover

Movies
Series
Slates
```

---

## Profile

Current:

```text
Ratings
Watched
Shelf
```

Add:

```text
Ratings
Watched
Shelf
Slates
```

---

## User Profile

```text
Ashik

152 Ratings
97 Watched
31 Shelf
12 Slates
```

---

## Slate Creation

Button:

```text
+ Create Slate
```

Modal:

```text
Title

Description

Visibility

○ Public
○ Private

Collaborators

Create Slate
```

---

## Movie Page

Instead of:

```text
+ Shelf
```

and that's it.

Add:

```text
+ Add to Slate
```

---

When clicked:

```text
Add to Slate

Weekend Watchlist

Korean Cinema

Films That Changed Me

Create New Slate
```

---

## Slate Detail Page

This is where I'd take inspiration from Spotify, not Letterboxd.

Hero:

```text
SLATE

Films That Changed Me
```

Under:

```text
Created by Ashik

37 titles

Movies + Series
```

Then:

```text
Like
Save
Share
Collaborate
```

---

## Public / Private

I would actually rename them.

Instead of:

```text
Public
Private
```

Use:

```text
Open Slate
```

Visible to everyone.

and

```text
Circle Only
```

Visible to:

* Orbit
* Collaborators

This feels more on-brand.

---

## Feed

Don't show them like Letterboxd.

The Letterboxd feed looks dated.

Instead:

```text
Trending Slates
```

Horizontal cards.

Example:

```text
┌─────────────────┐
│ Memories of     │
│ Murder          │
│ Oldboy          │
│ Burning         │
│ ...             │
└─────────────────┘

Korean Essentials

By Ashik
```

Use poster mosaics.

---

## Collaborative Slates

This is where SlateClub can beat Letterboxd.

Example:

```text
Ashik × Rahul

Weekend Watchs
```

Contributors:

```text
Ashik
Rahul
```

Both can:

* Add
* Remove
* Reorder

---

## Orbit Integration

This becomes powerful.

Example:

```text
5 people in your Orbit saved this Slate.
```

---

## Taste Engine Integration

A Slate should become a signal.

Example:

User creates:

```text
Best Mind-Bending Movies
```

containing:

* Primer
* Coherence
* Predestination
* Donnie Darko

SlateClub learns:

```text
Mind-Bending
```

is part of their taste.

---

## Naming

I would consistently use:

```text
Create Slate

Add to Slate

Save Slate

Collaborative Slate

Open Slate

Circle-Only Slate
```

Never use:

```text
List
Collection
Playlist
Board
```

because "Slate" itself is a strong product concept and helps make SlateClub feel like its own ecosystem rather than a Letterboxd clone.


I'd tell Claude Code to **copy the interaction model, not the visual design**.

If you clone Letterboxd's UI 1:1, Slate will feel like a Letterboxd skin.

Instead:

* Copy the feed mechanics.
* Copy the list/slate discovery patterns.
* Rebuild the visuals using Slate's premium black + orange identity.

---

# Prompt for Claude Code

Build a new feature called "Slates".

A Slate is the equivalent of a Spotify playlist for movies and series.

DO NOT copy Letterboxd visually.

Use Slate's existing design language:

* black background
* subtle borders
* orange accent
* premium cinematic feel
* large artwork
* generous spacing

The interaction model can be inspired by Letterboxd Lists and Spotify Playlists.

---

CORE CONCEPT

Users can create:

1. Personal Slates
2. Collaborative Slates

A Slate can contain:

* Movies
* Series
* Mixed content

Examples:

Movies That Broke Me

Best Korean Thrillers

Dad Movies

Films To Watch On Rainy Nights

Ashik + Rahul Weekend Watchlist

---

CREATE SLATE FLOW

Create Slate button.

Modal:

Title

Description

Cover Image (optional)

Visibility

○ Public
○ Private

Collaborators

[ Search Users ]

Create Slate

---

VISIBILITY

Public

* Discoverable
* Searchable
* Visible to everyone

Private

* Visible only to:

  * creator
  * collaborators
  * users in Orbit (friends)

Visibility can be changed later from Slate Settings.

---

ADDING CONTENT

Every Movie Page

Every Series Page

Add button:

* Add To Slate

When clicked:

Show existing Slates

My Slates

* Korean Cinema
* Weekend Watchlist
* Films That Changed Me

Create New Slate

Select slate and save.

---

COLLABORATIVE SLATES

Creator can invite users.

Collaborators can:

* add items
* remove items
* reorder items
* edit description

Display collaborators:

Ashik
Rahul
Ananya

with avatars.

---

DISCOVER PAGE

Add a dedicated tab:

Slates

Layout inspired by Letterboxd list discovery.

Feed cards.

Each card contains:

Cover collage

Title

Creator

Item count

Likes

Collaborators count

---

SLATE COVER

Generate automatically.

Use first four posters.

2x2 poster collage.

If user uploads custom cover:

Use custom cover.

---

SLATE DETAIL PAGE

Hero section.

Large cinematic cover.

Gradient overlay.

Title.

Description.

Creator.

Collaborators.

Stats:

Movies
Series
Likes
Saves

Actions:

Like

Save Slate

Share

Collaborate

---

CONTENT GRID

Display ranked order.

1
2
3
4

Large posters.

Responsive layout.

Desktop:
5-6 columns.

Mobile:
3 columns.

---

SORTING

Drag and drop.

Reorder items.

Persist order.

---

COMMENTS

Allow comments on public slates.

Comment thread at bottom.

---

DISCOVER FEED

Show:

Trending Slates

New Slates

From Orbit

Because You Liked

Collaborative Slates

---

RECOMMENDATION ENGINE INTEGRATION

A Slate becomes a recommendation signal.

Example:

User saves:

Top Korean Thrillers

Boost:

Memories of Murder
Oldboy
Burning

inside taste engine.

---

PROFILE INTEGRATION

Add new profile metric.

Ratings
Watched
Shelf
Slates

Profile section:

Created Slates

Saved Slates

Collaborative Slates

---

ROUTES

/slates

/slates/[slug]

/create-slate

/slates/[slug]/settings

---

VISUAL STYLE

Do NOT recreate Letterboxd.

Use:

* cinematic spacing
* premium typography
* large cover artwork
* smooth hover animations
* subtle orange highlights
* Spotify-quality polish

The result should feel like:
Spotify Playlists + Letterboxd Lists + Slate branding.

---

One thing I'd add that Letterboxd doesn't have:

### Slate Blend

If two users are collaborators:

```text
Ashik × Rahul
```

Create a shared slate automatically:

```text
Shared Universe
```

containing movies and series both users are likely to enjoy.

That's the kind of feature people will actually share, and it ties directly into your Orbit/Taste Match system.
