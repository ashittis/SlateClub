# SlateClub — Product Vision & Feature Analysis

> **The idea in one line:** Spotify's taste intelligence × Letterboxd's film culture × Reddit/X's live discourse — built for cinema lovers.

---

## What the Screens Show (UI/UX Analysis)

### Visual Language & Design System

The UI operates on a **dark, cinema-grade aesthetic** — deep blacks, near-black charcoals, with selective accent colour bursts (green for the Taste Engine CTA, coral/red for active nav, muted warm tones for the home feed's ambient glow). This isn't accidental — it mirrors the feeling of a darkened screening room. Everything is intentional:

- **Cards are the primary unit of content.** Film posters are treated like album art — they carry visual weight, not just metadata. Cards use a ranked overlay (the "1", "2" numbering on Trending) to add editorial weight without clutter.
- **Pill-tag chips** (intense · thriller · Korean · Netflix · 2020s) are interactive, coloured differently per category (mood = amber, genre = green, language = tan, platform = purple, era = violet). This colour coding is a silent taxonomy — users learn it without reading a label.
- **Circular avatars for artists and twins** feel social, familiar — borrowed from Instagram/Twitter grammar but applied to directors, actors, and taste-matched users equally. This subtly says: directors are as followable as people.
- **The home feed has a hero card stack** — a fanned, layered poster carousel with ambient background colour pulled from the film's palette. This is closer to Apple TV's fullscreen immersion than Letterboxd's list view.
- **The Taste Engine** sits at the top of Discover as a **sentence builder**, not a filter panel. This is the single most distinctive UI decision in the product.
- **The constellation/bubble view** in the Taste Engine results (Image 4) is a scatter of circular film posters on a dark red gradient — sized by relevance, not in a grid. This is mood-native, not database-native.

---

## Feature Breakdown (From the Screens)

### 1. Taste Engine (The Core)
- A **natural language sentence builder**: "Show me [mood] [genre] films in [language] on [platform] from [era]"
- Each token in the sentence is a **tappable, swappable pill** — not a dropdown
- Real-time match count updates as filters are added ("7 films match")
- Results render as an **organic bubble constellation**, not a list — films sized by relevance/score
- A "Modify" option lets users tweak the query from the results screen without going back

### 2. Home Feed
- **"X films handpicked for you"** — personalised hero feed with a count, updated in near real-time ("updated 4m ago")
- Films shown with: title, director, year, language, runtime, rating, awards badge (National Award, etc.)
- Context signals on each card: "Trending in Chennai · 3 twins watched" — hyper-local social proof
- Action row on hero card: Dislike / Add to shelf / Mark as watched

### 3. Social Feed (Network / Artists / World tabs)
- **Network tab**: Activity from people you follow — "Sneha P. added *Burning* to Korean Slow Burns — 'Lee Chang-dong's masterpiece.'"
- Like, Reply, Save on each activity post
- **Artists tab**: Activity from directors, actors, cinematographers you follow
- **World tab**: Global film community activity — equivalent to X's "For You" but cinema-only

### 4. Discover — Sections
- **Trending now**: Platform-tagged (PRIME / NETFLIX / MUBI) film cards with ranking numbers
- **Slates worth saving**: Curated multi-film collections with contributor avatars and counts
- **Browse by platform**: Netflix / Prime / HBO / MUBI / Disney+ / Hotstar tiles with personalised counts ("86 for you")
- **Artists on your radar**: Circular director/actor cards — followable, with film counts
- **Awards**: Oscars 2025 / National Awards / Cannes 2025 — browseable by ceremony
- **Your twins right now**: Films currently being watched by your taste-matched users
- **From your twins' shelves**: Collections curated by twins — borrowable taste
- **Twin profiles**: User cards showing match % (92% twin), taste tags (slow burn · Korean), film and slate counts

### 5. Slates (Shelf/List System)
- User-curated film collections with a name, contributor avatars, and film count
- Examples: "Cinema That Changed History", "Korean Slow Burns", "Sunday Night Binge", "Ones That Haunt"
- Slates are shareable social objects — not private lists
- Can be collaborative (multiple contributors visible)

### 6. Taste Twins
- Algorithmic taste-matching between users — shown as a % match score
- Not just "you both liked the same films" — based on mood tags, pacing preferences, language affinity
- Twins' activity directly feeds your discovery (what they're watching, what they're shelving)

---

## What's Missing — Features to Add

### A. Taste Onboarding (The Spotify "First Play" Moment)

This is the most critical gap for a cold-start user. Here's how to do it **cinematically**, not like a survey:

**The Onboarding Flow — "Tune Your Taste"**

1. **Languages first** — "Which languages feel like home?" (Cards with flag + language name, multi-select). Not just spoken language — film language. Hindi, Tamil, Korean, French, Malayalam, etc.
2. **The Poster Gut Test** — Show 12–16 film posters with zero text. Just art. Ask: "Tap the ones that pull you in." No titles, no ratings. Pure visual instinct. The backend infers mood, genre, era, aesthetic from their picks.
3. **Pace & Mood Sliders** — "Do you lean towards..." with two poles:
   - Slow burn ←→ High octane
   - Dark & heavy ←→ Light & funny
   - Realism ←→ Surreal/stylised
4. **Platforms you have** — Simple toggles: Netflix / Prime / MUBI / Hotstar etc. (avoids recommending what they can't watch)
5. **One director or actor you love** — Free text or search. Just one. This anchors the entire early recommendation graph.
6. **Your cinema origin story** — "The first film that made you feel something." Optional. If filled, used as a deep taste anchor. Creates an emotional hook to the app from day one.

After this: "We found **43 films** that match your taste. Your twins are already watching 6 of them."

---

### B. Creator/Artist Layer (The X/Instagram Gap)

What Letterboxd completely lacks — **official presence for the people who make films:**

- **Verified Artist Profiles** — Directors, actors, cinematographers, composers with a blue/gold badge
- **Artist Posts** — Trailers, behind-the-scenes clips, stills, personal film recommendations, watchlists
- **Production Slates** — Official curated lists by filmmakers ("Films that influenced this movie")
- **Premiere Announcements** — Festival selections, OTT drops posted directly by the production
- **Ask Me Anything threads** — Time-limited Q&A sessions within the app (Reddit AMA but cinema-native)
- **Artist Activity in Feed** — "Lijo Jose Pellissery added *Pather Panchali* to his watchlist" is infinitely more interesting than a random user doing the same

---

### C. Live & Time-Sensitive Layers

- **Now Showing** — Theatre listings integrated. "4 people in your network are watching this in PVR tonight."
- **Watch Parties** — Synced viewing with real-time reactions (for OTT films)
- **Festival Mode** — During Cannes, TIFF, MAMI etc., a dedicated feed for reviews, reactions, live updates from attendees and critics
- **Premiere Countdowns** — Films you've tracked show a countdown to their OTT/theatre release

---

### D. Discourse Layer (The Reddit Thread Gap)

- **Film Threads** — Each film has a community page: spoiler-gated discussion, scene analysis, context posts
- **Slate Rooms** — Group discussions around a curated Slate (like a book club but for films)
- **Hot Takes** — Short-form X-style posts (280 chars) on films, visible on the film's page and in the global feed
- **Critical Takes** — Longer-form reviews with formatting, spoiler tags, and "Agree/Disagree" voting (not just likes)
- **Polls** — "Best Park Chan-wook film?" — votable directly in feed

---

### E. Discovery Intelligence (Beyond the Taste Engine)

- **Mood-based discovery** — "I want to feel something tonight" as an entry point, not a genre filter
- **The Rewatch Detector** — Identifies films users would likely rewatch based on their history (high engagement signal)
- **Director Filmography Mode** — "Watch the complete Satyajit Ray in chronological/best-to-worst order"
- **The Connector** — "You love *Parasite*. The cinematographer also shot *Burning*. Here's the thread."
- **Cultural Context Cards** — Before you watch a film, optional: historical/cultural context for international films
- **Hidden Gem Alerts** — "3 of your twins rated this 4.5+ and it has under 500 ratings globally"

---

### F. Community Architecture

- **Follow system**: Follow users, artists, and Slates independently
- **Taste Circles**: Small private groups (6–12 people) for close-friends film culture — like a group chat but organised around films
- **Critic Badges**: Power users who consistently write high-quality reviews get elevated visibility
- **Local Chapters**: City-level communities — "Hyderabad Cinema Lovers" — for local screening events, recommendations by geography
- **Slate Collaboration**: Invite friends to co-curate a Slate together

---

## How SlateClub Beats Letterboxd

| Dimension | Letterboxd | SlateClub |
|---|---|---|
| Recommendation | None — purely social/manual | AI taste engine + twin network |
| Discovery UI | List/grid | Sentence builder + bubble constellation |
| Social layer | Follow + reviews | Twins, Slates, Circles, threads |
| Artist presence | None | Verified profiles, posts, AMAs |
| Onboarding | None | Cinematic taste calibration flow |
| Real-time | None | Live twins, watch parties, festival mode |
| Platform awareness | Manual logging | Integrated — "X for you on Netflix" |
| Local/cultural | Weak | Language-first, regional cinema elevated |
| Short-form discourse | None | Hot Takes (X-style) |
| Long-form discourse | Reviews only | Threads, scene analysis, Slate Rooms |

---

## The Core Ideology

SlateClub is not a database with social features bolted on. It's a **living taste organism**. 

The recommendation engine doesn't just suggest films — it finds you *people* who feel cinema the way you do. Those people's activity becomes your discovery layer. Their shelves become your watchlist. Their twins become your extended network. The graph grows outward from taste, not from who you already know.

The platform treats cinema as **culture**, not content. A film isn't a row in a database — it's a conversation, a feeling, a cultural artefact with context. Every feature should reinforce that.

> **The north star metric isn't "films logged." It's "meaningful cinema moments created."**

---

---

# Page-by-Page UX Flow — Mobile & Web

> Every screen described below covers layout, key elements, and intent. Mobile and Web are treated separately where they meaningfully differ.

---

## PHASE 1 — PRE-LOGIN (Public / Guest State)

---

### Page 1 — Landing / Splash Screen

**Mobile**
Full-screen cinematic video loop — a slow montage of iconic film frames (no audio). Centred logo "SlateClub" in white. Two CTAs stacked vertically: `Get Started` (filled, green) and `Log In` (ghost button). Tagline beneath logo: *"Find your next film. Find your people."* No nav bar. No header. Just the mood.

**Web**
Full-viewport hero with the same video loop playing on the left two-thirds. Right third: a dark panel with the logo, tagline, email signup field, and `Get Started` CTA. Below the fold: a scrollable explainer — three feature highlights (Taste Engine, Twins, Slates) with motion graphics. Footer with links.

---

### Page 2 — Sign Up / Log In

**Mobile**
Clean single-column form. Options: `Continue with Google`, `Continue with Apple`, divider line with "or", then Email + Password fields. Below: `Already have an account? Log in`. Minimal — no marketing copy here, the splash already did that job. Dark background, white text, green primary button.

**Web**
Centred modal-style card on a blurred film-still background. Same options as mobile. On the login variant, a "Forgot password" link appears inline. No full-page redirect — it's an overlay on the landing page.

---

## PHASE 2 — ONBOARDING (First-Time User Flow)

> This is the "Tune Your Taste" sequence. It runs once, right after account creation. Each step is a full screen — no sidebars, no nav, no distractions. Progress shown as a thin line at the top (5 dots / stages). Users can skip any step but are gently nudged not to.

---

### Onboarding Step 1 — Welcome Screen

**Mobile & Web (same intent, different scale)**
Black screen. Animated text fades in: *"Before we find your films — let's find your taste."* Subtext: *"5 quick steps. No wrong answers."* Single CTA: `Let's go →`. On web, this sits centred in a wide dark panel. On mobile, it's full screen.

---

### Onboarding Step 2 — Language Selection

**Title:** *"Which languages feel like home?"*

**Mobile**
Scrollable grid of language cards — each card has a country/region visual and the language name. Examples: Hindi, Tamil, Telugu, Malayalam, Bengali, Korean, French, Japanese, Spanish, Italian, Mandarin, Arabic. Multi-select — tapping highlights the card with a coloured border. Minimum 1 required. `Next →` button fixed at bottom.

**Web**
Same grid but displayed in 4–5 columns in the centre of the screen. Larger cards. Same multi-select behaviour. CTA in bottom-right corner.

*Backend intent:* Seeds the recommendation engine's language affinity weights and filters out films the user likely won't engage with.

---

### Onboarding Step 3 — The Poster Gut Test

**Title:** *"Tap the posters that pull you in. Don't think — just feel."*

**Mobile**
A 3-column mosaic of 15 film posters — no titles, no ratings, no text of any kind. Just raw poster art. Tapping a poster adds a subtle green glow border. Users select as many or as few as they want. Minimum of 3 encouraged via a soft counter ("pick at least 3"). Posters are chosen by the system to span across eras, moods, aesthetics, and styles — not genres. `Done` button appears after 3 selections.

**Web**
A 5-column mosaic. Same interaction. On hover, posters get a slight scale-up. On select, a green overlay with a checkmark tick. More visual real estate = more posters visible without scrolling (can show 20).

*Backend intent:* Each poster is tagged with hidden metadata — mood, pacing, visual style, era, cultural origin. The user's selections build a taste fingerprint without them knowing they're filling out a form.

---

### Onboarding Step 4 — Mood Sliders

**Title:** *"Where do you usually land?"*

**Mobile**
Three sliders, each full-width, with two poles labelled at each end:
- Slider 1: `Slow Burn` ←→ `High Octane`
- Slider 2: `Dark & Heavy` ←→ `Light & Fun`
- Slider 3: `Grounded Realism` ←→ `Surreal & Stylised`

Each slider has a small emoji anchor at each pole. Default position is centre. The slider thumb glows green. Stacked vertically with breathing room between each.

**Web**
Same three sliders but displayed side by side or in a more spacious two-column layout. Larger drag targets. Visual label updates as the slider moves ("You lean: Slow Burn").

*Backend intent:* Encodes pacing and tonal preference — the most under-served axis in film recommendation.

---

### Onboarding Step 5 — Platform Selection

**Title:** *"Which platforms do you have?"*

**Mobile**
Large toggle cards for each platform — Netflix, Prime Video, MUBI, Hotstar, Disney+, HBO, Apple TV+, SonyLIV, Zee5. Each card has the platform logo and name. Toggle on/off. Can select all or none. Small note at bottom: *"We'll only show you films you can actually watch."*

**Web**
Two-row grid of platform cards. Same toggle interaction. Optionally: a "I prefer theatres" toggle that activates Now Showing recommendations.

*Backend intent:* Hard filter layer — prevents recommendation frustration where great films are unreachable.

---

### Onboarding Step 6 — One Artist Anchor

**Title:** *"Name one director or actor you love."*

**Mobile**
A single search bar, auto-focused, with a keyboard immediately visible. As the user types, a live dropdown shows matching artists with their photo, role (Director / Actor), and a notable film. Selecting one locks it in with a profile card. Below it, a subtle prompt: *"Just one. We'll find the rest."* Optional skip link.

**Web**
Same search with a larger dropdown panel, showing 6 results at once with richer cards (photo, name, role, 3 notable films).

*Backend intent:* The single strongest cold-start signal. One artist anchors an entire taste neighbourhood — their collaborators, influences, and fans become the user's first twin candidates.

---

### Onboarding Step 7 — Cinema Origin Story (Optional)

**Title:** *"The first film that made you feel something."*

**Mobile**
Same search bar as Step 6, but for films. Below the search: *"This is optional — but it tells us everything."* If skipped, the app proceeds. If filled, the film gets a special "origin" tag in the user's taste profile, used as a north-star anchor for deep recommendations.

**Web**
Identical, with the addition of a small poster preview appearing when a film is selected.

---

### Onboarding Step 8 — Taste Ready Screen

**Mobile & Web**
Animated reveal screen. The SlateClub logo pulses once. Then: *"We found you **[X] films**."* Below: *"Your twins are already watching [Y] of them."* A row of 3–4 film poster thumbnails fades in beneath. Then: `Enter SlateClub →` CTA. Full green button. This is the payoff moment — make it feel like the curtain rising.

---

## PHASE 3 — CORE APP PAGES

> After onboarding, the user enters the main app. Navigation is bottom-tab on mobile, left-sidebar + top-nav on web.

---

### Navigation Structure

**Mobile — Bottom Tab Bar (4 tabs)**
1. 🏠 Home
2. 🔍 Discover
3. 📚 Slates
4. 🎬 Profile

**Web — Left Sidebar (persistent)**
- Logo at top
- Home
- Discover
- Slates
- Community
- Notifications
- Profile
- Settings

Top nav on web: Search bar (persistent), Watchlist icon, Calendar/Releases icon.

---

### Page: Home Feed

**Mobile**
- Top: User avatar (top-left), Watchlist icon, Releases calendar, Search (top-right)
- Hero section: Large stacked card fan showing 2–3 films behind the featured one. Ambient background colour bleeds from the poster. Film title, director, year, language, runtime, rating, awards badge. Action row: Dislike / Add to Shelf / Mark Watched
- Below hero: Horizontal scrollable feed of activity posts (Network tab active by default). Each post shows: user avatar, name, Taste Twin badge if applicable, time, action ("added X to Y"), short quote, film thumbnail. Like / Reply / Save actions.
- Tab row above feed: `All` · `Network` · `Artists` · `World`
- Fixed floating `+` button (green) for logging a film or creating a Slate

**Web**
- Two-column layout: Left ~65% = main feed. Right ~35% = sidebar with "Your Twins Right Now", "Trending in Your City", "Upcoming Releases"
- Hero card is a wide banner across the full left column — not a mobile card fan
- Activity feed below hero, same tab structure
- No floating button — actions accessed via inline CTAs and the left nav

---

### Page: Discover

**Mobile**
- Top: "Discover" heading with eye icon, watchlist, calendar, search
- Taste Engine card at top — the sentence builder. Collapsed by default (shows last used query). Tap to expand. Shows match count and `Show me →` CTA
- Scrollable sections below: Trending Now → Slates Worth Saving → Browse by Platform → Artists on Your Radar → Awards → Your Twins Right Now → From Your Twins' Shelves → Twin Profiles

**Web**
- Left: Taste Engine as a full expanded panel (not collapsed). Always visible. It's the centrepiece of the Discover page.
- Right: Scrollable sections as a 2–3 column grid. Cards are larger and show more metadata.
- Taste Engine results open in-page (right panel updates) rather than navigating to a new screen

---

### Page: Taste Engine Results

**Mobile**
- Top bar: Back arrow, current query displayed as pills, `Modify` button
- Heading: "We found you [X] Films"
- Below: The bubble constellation — circular film poster thumbnails scattered organically. Tapping a bubble shows the film name + year below it. Long press or tap opens the Film Detail page.
- Background: Dark radial gradient (deep red to black) — moody, not clinical

**Web**
- Same constellation view but taking up the full right panel or a full-page overlay
- Hovering a bubble shows a tooltip with film name, year, director, rating
- A list/grid toggle allows switching from constellation to a standard grid if preferred
- Sidebar on the right: active filter summary, option to save this query as a "Taste Preset"

---

### Page: Film Detail

**Mobile**
- Full-screen poster at top with a dark gradient overlay bottom-half
- Film title (large, white), director, year, language, runtime, rating stars, awards badges
- Platform availability: Netflix / Prime icons indicating where it's streaming
- Action row: `+ Shelf` · `✓ Watched` · `♡ Save` · `Share`
- Twin Signal: "3 of your twins rated this 4.5+" — small card with their avatars
- Tabs below: `About` · `Discuss` · `Reviews` · `Similar`
  - About: Synopsis, cast, crew, trailer link
  - Discuss: Film thread — hot takes, scene analysis, spoiler-gated posts
  - Reviews: Long-form critical takes with Agree/Disagree voting
  - Similar: Films connected by mood, crew, or aesthetic

**Web**
- Left: Tall poster
- Right: All metadata, platform badges, action buttons
- Below: Full-width tabbed section (About / Discuss / Reviews / Similar) — much more content visible at once
- Sidebar: Taste Twin activity on this film ("Ananya watched this · 2 days ago")

---

### Page: Slates (Library)

**Mobile**
- Header: "Slates" with a `+ New Slate` button
- My Slates: Horizontally scrollable row of user's own Slates — each shown as a stacked poster grid with title and count
- Saved Slates: Slates from twins and artists the user has bookmarked
- Trending Slates: Community curated, ranked by saves this week
- Each Slate card: 4-poster collage thumbnail, title, curator name, film count, platform dot indicators

**Web**
- Three-column grid of Slate cards — much more browseable
- Left sidebar filter: My Slates / Saved / Trending / By Friends / By Artists
- Clicking a Slate opens it in the right panel (no page navigation)

---

### Page: Slate Detail

**Mobile**
- Top: Slate title (large), curator avatar + name, description, film count, Save button
- Collaborative indicator: If multiple curators, their avatars stack ("+2 curators")
- Film list: Vertical scrollable list of films with poster thumbnail, title, year, language, rating, and short note from the curator
- Bottom: "Discuss this Slate" button → opens a Slate Room (group discussion thread)
- Share Slate button

**Web**
- Two-column: Left = film list with curator notes. Right = Slate discussion panel (Slate Room) visible side by side.

---

### Page: Community / Feed

**Mobile**
- Tab bar at top: `All` · `Network` · `Artists` · `World`
- Feed cards:
  - Activity posts (added film to slate, rated film, wrote review)
  - Hot Takes (short-form, 280-char posts about a film)
  - Polls ("Best Mani Ratnam film?")
  - AMA announcements (upcoming / live)
  - Festival live updates (during Cannes, TIFF etc.)
- Each card has: avatar, name, badge (Taste Twin / Artist / Critic), timestamp, content, film thumbnail if applicable, Like / Reply / Save

**Web**
- Two-column layout: Main feed (left) + Trending Topics sidebar (right) — "What the community is talking about"
- Composer bar at top for posting a Hot Take or starting a thread

---

### Page: Artist Profile

**Mobile**
- Top: Full-width cinematic banner (from their most iconic film). Artist photo overlaid (circular, large). Name, role (Director / Actor / Cinematographer), verification badge.
- Stats row: Films · Followers · Following
- `Follow` button (green)
- Tabs: `Posts` · `Filmography` · `Slates` · `About`
  - Posts: Trailers, stills, behind-the-scenes, watchlists they've shared
  - Filmography: All their films, filterable by role, with ratings and streaming availability
  - Slates: Official curated lists ("Films that inspired Virumaandi")
  - About: Bio, awards, career overview

**Web**
- Wide header banner with artist photo left-aligned
- Four tabs displayed horizontally below — content takes up full width
- Filmography shows in a rich 4-column grid

---

### Page: User Profile (Own)

**Mobile**
- Top: Avatar, display name, username, bio, taste tags (slow burn · Korean · noir)
- Stats: Films logged · Slates · Twins · Followers
- Taste Identity card: Generated summary — "You love slow, atmospheric world cinema. Your top languages: Korean, Tamil, French."
- Tabs: `Watched` · `Slates` · `Reviews` · `Twins`
- Watching history shown as a poster grid — filterable by year, rating, language

**Web**
- Left column: Profile card, stats, taste identity
- Right: Full tabbed content in grid layout

---

### Page: User Profile (Other User / Twin)

Same as own profile but:
- `Follow` button replaces edit options
- Twin match % displayed prominently (e.g., "87% Taste Twin")
- "Films you'd both love" — a dynamically generated set of recommendations based on the overlap
- Mutual twins section ("You share 4 twins")

---

### Page: Notifications

**Mobile**
Grouped notifications:
- **Twin Activity**: "Ananya (your 92% twin) just added a film to Korean Slow Burns"
- **Social**: Likes, replies, mentions
- **Releases**: "Decision to Leave is now on MUBI — on your watchlist"
- **Artist**: "Lijo Jose Pellissery posted a new trailer"
- **AMAs**: "Wong Kar-wai's AMA starts in 30 minutes"

**Web**
Notifications in a dropdown panel from the top nav (no separate page). Clicking one navigates in-page.

---

### Page: Search

**Mobile**
- Search bar auto-focused, full-width
- As user types: Live results across Films, Artists, Users, Slates — shown in categorised rows
- Below search bar (before typing): Recent searches, Trending searches, Trending films

**Web**
- Persistent search bar in top nav
- Results open in a dropdown for quick access, or `Enter` goes to full search results page
- Full results page: Left sidebar with type filters (Films / Artists / Users / Slates), right = results grid

---

### Page: Settings

**Mobile**
Simple list view:
- Account (email, password, linked accounts)
- Taste Profile (re-run onboarding, adjust language and platform preferences)
- Notifications (granular toggles per type)
- Privacy (profile visibility, twin matching on/off)
- Appearance (dark only — this app doesn't do light mode)
- About / Feedback

**Web**
Left nav for settings categories, right panel for each settings section content.

---

## Page Flow Summary

```
Landing
  └── Sign Up / Log In
        └── Onboarding Step 1: Welcome
              └── Step 2: Language Selection
                    └── Step 3: Poster Gut Test
                          └── Step 4: Mood Sliders
                                └── Step 5: Platform Selection
                                      └── Step 6: Artist Anchor
                                            └── Step 7: Origin Film (optional)
                                                  └── Step 8: Taste Ready → Enter App

App (Main)
  ├── Home Feed
  │     ├── Film Detail
  │     │     ├── About
  │     │     ├── Discuss (Film Thread)
  │     │     ├── Reviews
  │     │     └── Similar Films
  │     └── Activity Post → User Profile
  ├── Discover
  │     ├── Taste Engine → Results (Bubble Constellation) → Film Detail
  │     ├── Trending Now → Film Detail
  │     ├── Slates Worth Saving → Slate Detail
  │     ├── Browse by Platform → Platform Page
  │     ├── Artists on Your Radar → Artist Profile
  │     └── Twin Profiles → User Profile (Twin View)
  ├── Slates
  │     ├── My Slates → Slate Detail → Slate Room
  │     ├── Saved Slates → Slate Detail
  │     └── + New Slate → Slate Creator
  ├── Community Feed
  │     ├── Hot Takes → Film Detail
  │     ├── AMA → Artist Profile
  │     └── Festival Live Feed
  └── Profile
        ├── Own Profile → Edit Taste Profile
        ├── Watched Grid → Film Detail
        ├── Twins → User Profile (Twin View)
        └── Settings
```

---

*Document version: April 2026 — Page Flow Update Added*