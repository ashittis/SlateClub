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
    primary: "#FF7A00",
    primaryHover: "#FF9800",
  },
  // Warm brand gradient (orange → red → coal). For JS/SVG/canvas use.
  gradient: {
    amber: "#FF9408",
    rust: "#CA3F16",
    crimson: "#95122C",
    coal: "#100C08",
  },
  nav: {
    active: "#C4716E",
  },
} as const;

export type PillKind = keyof typeof tokens.pill;

export const pillColor = (kind: PillKind) => tokens.pill[kind];
