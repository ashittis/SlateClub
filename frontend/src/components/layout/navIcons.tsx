/*
  Primary-nav icons. Hand-drawn geometry, 1.5px strokes, no icon pack.

  They read as drafting marks rather than app-store glyphs, which is what the
  early-2000s/cassette direction wants. `currentColor` throughout so the active
  state is a single colour swap at the call site.
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

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5Z" />
      <path d="M8 17v-5h4v5" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

/** Tape spines on a shelf — the library as a row of cassettes. */
export function LibraryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 4v12M7.5 4v12M11.5 4v12" />
      <path d="M14.6 4.6l2.9 11.2" />
    </svg>
  );
}

export function CreateIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.25" y="3.25" width="13.5" height="13.5" rx="1.5" />
      <path d="M10 6.75v6.5M6.75 10h6.5" />
    </svg>
  );
}

export const NAV_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  "/home": HomeIcon,
  "/search": SearchIcon,
  "/library": LibraryIcon,
  "/create": CreateIcon,
};

export function MessagesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 5.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-3.5 3v-3h-0a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 8a4 4 0 0 1 8 0c0 3 .9 4.4 1.5 5H4.5C5.1 12.4 6 11 6 8Z" />
      <path d="M8.5 15.5a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}
