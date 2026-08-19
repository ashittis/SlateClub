import { tokens } from "./design-tokens";

/**
 * Genre duotones — the colour system the content drives.
 *
 * A single accent applied everywhere is a skin. Keying the wash to genre means
 * a thriller and a comedy don't look alike, and the app's colour actually
 * carries information: you can tell what kind of film you're looking at before
 * you read the title.
 *
 * Used in two places, deliberately the same map:
 *   - editorial imagery (film backdrops, share cards, match reveals)
 *   - the genre browse tiles in Search
 *
 * Posters in grids and lists are NOT duotoned — they're the content, and
 * washing them makes films unrecognisable at thumbnail size.
 */

export interface Duotone {
  /** The hue washed over the midtones. */
  a: string;
  /** The shadow the image is multiplied into. */
  b: string;
  /** Readable text colour on top of this pairing. */
  on: string;
}

const { accent, canvas, ink } = tokens;

const BLOOD_VOID: Duotone = { a: accent.blood, b: canvas.void, on: ink.chalk };
const COBALT_VOID: Duotone = { a: accent.cobalt, b: canvas.void, on: ink.chalk };
const ACID_VOID: Duotone = { a: accent.acid, b: canvas.void, on: canvas.void };
const MAGENTA_VOID: Duotone = { a: accent.magenta, b: canvas.void, on: ink.chalk };
const MAGENTA_BLEACH: Duotone = { a: accent.magenta, b: canvas.bleach, on: canvas.void };
const XEROX_BLEACH: Duotone = { a: ink.xerox, b: canvas.bleach, on: canvas.void };
const BLOOD_SOOT: Duotone = { a: accent.blood, b: canvas.soot, on: ink.chalk };

/** TMDB genre name (lowercased) → duotone. */
const BY_GENRE: Record<string, Duotone> = {
  thriller: BLOOD_VOID,
  crime: BLOOD_VOID,
  action: BLOOD_VOID,
  mystery: BLOOD_SOOT,
  horror: BLOOD_SOOT,
  "science fiction": COBALT_VOID,
  fantasy: COBALT_VOID,
  adventure: COBALT_VOID,
  comedy: ACID_VOID,
  animation: ACID_VOID,
  family: ACID_VOID,
  drama: MAGENTA_BLEACH,
  romance: MAGENTA_VOID,
  music: MAGENTA_VOID,
  documentary: XEROX_BLEACH,
  history: XEROX_BLEACH,
  war: XEROX_BLEACH,
  western: XEROX_BLEACH,
};

export const DEFAULT_DUOTONE = BLOOD_VOID;

/**
 * The duotone for a film. Takes the whole genre list and uses the first one
 * we recognise — TMDB orders genres by relevance, so the first match is the
 * film's dominant mode rather than an incidental tag.
 */
export function duotoneFor(genres: string[] | undefined | null): Duotone {
  if (!genres?.length) return DEFAULT_DUOTONE;
  for (const g of genres) {
    const hit = BY_GENRE[g.trim().toLowerCase()];
    if (hit) return hit;
  }
  return DEFAULT_DUOTONE;
}

/** Inline style for a `.duotone` wrapper. */
export function duotoneStyle(d: Duotone): React.CSSProperties {
  return { ["--duo-a" as string]: d.a, ["--duo-b" as string]: d.b };
}

/**
 * The genres offered as browse tiles in Search, in the order they appear.
 * `tmdbId` matches TMDB's genre ids so the discover endpoint can filter.
 */
export const BROWSE_GENRES: { name: string; tmdbId: number; duotone: Duotone }[] = [
  { name: "Thriller", tmdbId: 53, duotone: BLOOD_VOID },
  { name: "Drama", tmdbId: 18, duotone: MAGENTA_BLEACH },
  { name: "Science Fiction", tmdbId: 878, duotone: COBALT_VOID },
  { name: "Comedy", tmdbId: 35, duotone: ACID_VOID },
  { name: "Horror", tmdbId: 27, duotone: BLOOD_SOOT },
  { name: "Romance", tmdbId: 10749, duotone: MAGENTA_VOID },
  { name: "Documentary", tmdbId: 99, duotone: XEROX_BLEACH },
  { name: "Animation", tmdbId: 16, duotone: ACID_VOID },
  { name: "Crime", tmdbId: 80, duotone: BLOOD_VOID },
  { name: "Fantasy", tmdbId: 14, duotone: COBALT_VOID },
];

/** Decade tiles, for the other half of Search browse. */
export const BROWSE_DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960] as const;
