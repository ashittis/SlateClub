"use client";

import { tokens, type PillKind } from "@/lib/design-tokens";

/*
  GenreMoodTileGrid — the Search default-state browse grid (spec §2). Colored
  tiles mirror Spotify's genre tiles; each tile's colour follows the pill
  taxonomy (mood=amber, genre=green, language=tan, era=violet, platform=purple)
  so the category reads at a glance. Clicking a tile runs it as a query.

  Also renders a "Browse all" set of neutral editorial tiles.
*/

interface Tile {
  label: string;
  kind: PillKind;
  /** Query to run on click (defaults to the label). */
  q?: string;
}

const BROWSE: { label: string; kind: PillKind }[] = [
  { label: "New Releases", kind: "platform" },
  { label: "Community Picks", kind: "genre" },
  { label: "Award Winners", kind: "era" },
  { label: "Because everyone's watching", kind: "mood" },
];

const TILES: Tile[] = [
  { label: "Slow Burn", kind: "mood" },
  { label: "Feel-Good", kind: "mood" },
  { label: "Dark & Unsettling", kind: "mood" },
  { label: "Thriller", kind: "genre" },
  { label: "Drama", kind: "genre" },
  { label: "Comedy", kind: "genre" },
  { label: "Sci-Fi", kind: "genre" },
  { label: "Horror", kind: "genre" },
  { label: "Romance", kind: "genre" },
  { label: "Tamil", kind: "language" },
  { label: "Hindi", kind: "language" },
  { label: "Korean", kind: "language" },
  { label: "Japanese", kind: "language" },
  { label: "80s", kind: "era" },
  { label: "90s", kind: "era" },
  { label: "New Wave", kind: "era" },
];

interface Props {
  onPick: (q: string) => void;
}

export default function GenreMoodTileGrid({ onPick }: Props) {
  return (
    <div className="space-y-8">
      <Section title="Browse all">
        <Grid>
          {BROWSE.map((t) => (
            <TileButton key={t.label} label={t.label} kind={t.kind} onClick={() => onPick(t.label)} />
          ))}
        </Grid>
      </Section>

      <Section title="Explore by mood, genre & language">
        <Grid>
          {TILES.map((t) => (
            <TileButton
              key={t.label}
              label={t.label}
              kind={t.kind}
              onClick={() => onPick(t.q ?? t.label)}
            />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}

function TileButton({
  label,
  kind,
  onClick,
}: {
  label: string;
  kind: PillKind;
  onClick: () => void;
}) {
  const color = tokens.pill[kind];
  return (
    <button
      onClick={onClick}
      className="relative flex h-24 items-start overflow-hidden rounded-xl p-3 text-left transition-transform hover:scale-[1.02]"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${shade(color)} 100%)`,
      }}
    >
      <span className="display text-base font-bold" style={{ color: "#0A0A0B" }}>
        {label}
      </span>
      {/* Decorative tilted swatch, à la Spotify genre tiles */}
      <span
        aria-hidden
        className="absolute -bottom-3 -right-2 h-16 w-16 rotate-[25deg] rounded-md"
        style={{ background: "rgba(0,0,0,0.22)" }}
      />
    </button>
  );
}

// Darken a hex a touch for the gradient tail.
function shade(hex: string): string {
  const h = hex.replace("#", "");
  const to = (i: number) => Math.max(0, parseInt(h.slice(i, i + 2), 16) - 40);
  return `rgb(${to(0)}, ${to(2)}, ${to(4)})`;
}
