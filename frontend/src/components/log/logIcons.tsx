/*
  Icons for the log panel. Same rules as components/layout/navIcons.tsx —
  hand-drawn geometry, 1.5px strokes, `currentColor`, no icon pack.

  Two of these lean on the cassette metaphor rather than the generic app glyph,
  because they read better in this design system: a rewatch is a **rewind**
  (◀◀), not a refresh circle, and the TV has rabbit ears. Theatre and TV are
  deliberately drawn as different objects — a screen with seats versus a set —
  since "a rectangle" would make them the same picture.

  Toggle state is carried by shape, not colour: HeartIcon fills its own path
  when `filled`, so a liked viewing is legible without spending the --blood
  accent, which the film page reserves for its single primary action.
*/

type IconProps = { className?: string };

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* ---------------------------------------------------------------- modifiers */

/** Affection. Solid when set — the state is the shape, not a colour swap. */
export function HeartIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base} className={className} fill={filled ? "currentColor" : "none"}>
      <path d="M10 16.4C10 16.4 3 12.2 3 7.9C3 5.7 4.7 4 6.6 4C8.1 4 9.4 4.9 10 6.2C10.6 4.9 11.9 4 13.4 4C15.3 4 17 5.7 17 7.9C17 12.2 10 16.4 10 16.4Z" />
    </svg>
  );
}

/** Rewind, not refresh. You are watching the tape again. */
export function RewatchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.4 6.4v7.2L4.3 10z" />
      <path d="M16.4 6.4v7.2L11.3 10z" />
    </svg>
  );
}

/** Private — kept to yourself. */
export function LockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4.5" y="8.75" width="11" height="7.75" rx="1" />
      <path d="M7.1 8.75V6.6a2.9 2.9 0 0 1 5.8 0v2.15" />
    </svg>
  );
}

/** Spoilers — an eye you've covered. */
export function SpoilerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.6 10S5.6 5.6 10 5.6 17.4 10 17.4 10 14.4 14.4 10 14.4 2.6 10 2.6 10Z" />
      <circle cx="10" cy="10" r="2.1" />
      <path d="M4.2 15.8 15.8 4.2" />
    </svg>
  );
}

/* ------------------------------------------------------------- watch method */

/** A screen with two seats in front of it. */
export function TheatreIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.75 3.5h14.5v7.75H2.75z" />
      <path d="M4.4 16.5v-1.9a1.4 1.4 0 0 1 1.4-1.4h1.3a1.4 1.4 0 0 1 1.4 1.4v1.9" />
      <path d="M11.5 16.5v-1.9a1.4 1.4 0 0 1 1.4-1.4h1.3a1.4 1.4 0 0 1 1.4 1.4v1.9" />
    </svg>
  );
}

export function StreamingIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M8.4 6.9 13.6 10l-5.2 3.1z" />
    </svg>
  );
}

/** A set with rabbit ears. */
export function TvIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.75" y="6.75" width="14.5" height="9.75" rx="1" />
      <path d="M6.6 3 10 6.75 13.4 3" />
    </svg>
  );
}

export function OtherIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} strokeWidth={2.4}>
      <path d="M5.4 10h.01M10 10h.01M14.6 10h.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ chrome  */

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4.75" width="14" height="12.25" rx="1" />
      <path d="M3 8.5h14M6.9 2.9v3.6M13.1 2.9v3.6" />
    </svg>
  );
}

export function TagIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17 2.9h-5.9a1.2 1.2 0 0 0-.85.35L3.25 10.25a1.2 1.2 0 0 0 0 1.7l4.8 4.8a1.2 1.2 0 0 0 1.7 0l7-7a1.2 1.2 0 0 0 .35-.85z" />
      <circle cx="13.6" cy="6.3" r="1.05" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m5.6 5.6 8.8 8.8M14.4 5.6l-8.8 8.8" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m4.2 10.4 3.9 3.9L15.8 6" />
    </svg>
  );
}
