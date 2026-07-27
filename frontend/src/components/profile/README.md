# Profile components — the user's personal cinema page

These render a member's profile: their identity header, favourite films, watch history, ratings, diary, lists, and recent activity. They power both the signed-in "my profile" view and the layout for viewing others.

## Components
- **`ProfileHero.tsx`** — the header: avatar, name, @username, bio, and a 4-up stat row (Films, This Year, Following, Followers). Holds the "Edit profile" and "Sign out" buttons and opens the edit modal.
- **`EditProfileModal.tsx`** — form to change name, username, bio (160-char cap), and avatar URL, with live avatar preview and username validation. Saves via `PATCH /api/users/me`.
- **`FavoriteFilms.tsx`** — the pinned five "films that define your taste." View mode shows a poster grid with add slots; edit mode adds an inline film search and drag-to-reorder (Framer Motion `Reorder`). Saves via `POST /api/onboarding/movies`; reads `/api/users/me/favorites`.
- **`ProfileTabs.tsx`** — the tabbed library: Films, Diary, Ratings, Watchlist, Watching, DNF, Lists. Each tab fetches its own endpoint (`/api/users/me/watched`, `/api/diary`, `/api/users/me/ratings`, etc.); an animated underline slides between tabs.
- **`filmDisplays.tsx`** — shared presentational pieces used across the tabs: `FilmRow`, `DiaryRow` (with day stamp + theatre/rewatch/private badges), `PosterLink`, `ShelfCard`, and loading skeletons. Also exports the library-row TypeScript types.
- **`MediaFilter.tsx`** — the All / Movies / Series pill toggle with a sliding active pill. Exports `filterByMedia()` to filter lists by media type.
- **`ProfileSidebar.tsx`** — a compact rail with a fanned Watchlist strip and a recent Diary list.
- **`RecentActivityRow.tsx`** — a horizontal, de-duped strip of recently touched posters with rating badges. Reads `/api/activity/user/:id`.

## Notes
Posters are the primary unit throughout — treated as album art, with hover-scale and lazy loading. Data comes from TanStack Query against the `/api/users/me/*`, `/api/diary`, `/api/activity`, and `/api/slates` endpoints. Motion is used lightly: staggered poster fade-ins, spring underlines/pills, and drag reordering. Grids collapse from 5 columns to 3 on mobile.
