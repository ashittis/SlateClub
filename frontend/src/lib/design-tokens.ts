/*
  TS mirror of the CSS tokens in globals.css.
  Use these when colours need to live in JS/SVG/canvas
  (e.g. ambient backdrop interpolation, force-graph stroke).
  Do NOT inline these elsewhere — read from here so the
  palette has one source of truth.
*/
export const tokens = {
  surface: {
    screening: "#0A0A0B",
    card: "#111114",
    elevated: "#1A1A1F",
  },
  text: {
    primary: "#FAFAF7",
    muted: "#9A9AA0",
    faint: "#6A6A70",
  },
  pill: {
    mood: "#E0A050",
    genre: "#5CA572",
    language: "#B8956A",
    platform: "#8B6FB5",
    era: "#6E5BA8",
    neutral: "#3A3A42",
  },
  cta: {
    primary: "#5CA572",
    primaryHover: "#6FB585",
  },
  nav: {
    active: "#C4716E",
  },
} as const;

export type PillKind = keyof typeof tokens.pill;

export const pillColor = (kind: PillKind) => tokens.pill[kind];
