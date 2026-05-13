"use client";

export interface PlatformItem {
  key: string;
  label: string;
  color: string;
  personalisedCount: number;
}

interface Props {
  items: PlatformItem[];
}

export default function PlatformTiles({ items }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((p) => (
        <button
          key={p.key}
          className="relative h-24 rounded-xl text-left p-4 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${hexA(p.color, 0.85)}, ${hexA(p.color, 0.45)})`,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p
            className="display text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {p.label}
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
            {p.personalisedCount} for you
          </p>
        </button>
      ))}
    </div>
  );
}

function hexA(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
