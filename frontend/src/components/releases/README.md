# Releases components — upcoming & new film discovery

These power the "what's coming out" surface: a swipeable CoverFlow deck of upcoming titles and a month-long release calendar. Both lean hard into the cinema-dark, poster-as-album-art aesthetic.

## Components
- **`ReleaseCarousel.tsx`** — a 3D CoverFlow deck. The centre poster sits large and flat while neighbours recede (scale + `rotateY` + depth shadow); the active film's backdrop fills the panel as a blurred, gradient-lit ambient layer. Drag/swipe to move, tap a side card to focus it, tap the centre to open the film. Shows a friendly empty state when nothing is scheduled.
- **`ReleaseCalendar.tsx`** — a horizontal strip of date pills for the next ~31 days. Dates with releases carry a dot; the active date springs into focus (shared-layout amber pill) and reveals that day's films below in a staggered, animated grid. Each film row shows a colour-coded language pill and vote average.
- **`types.ts`** — shared `ReleaseFilm`, `ReleaseDay`, and `CalendarResponse` interfaces.

## Notes
Motion is central: Framer Motion drives the spring-based 3D deck, drag-to-advance with velocity thresholds, `AnimatePresence` crossfades on the ambient backdrop, and `layoutId` for the sliding calendar pill. Language pills use the shared `Pill` (`kind="language"`, tan). Both components receive data as props (parent fetches it) and render posters via `tmdbImage`. Built for touch first — swipe on the carousel, scrollable pill strip on the calendar.
