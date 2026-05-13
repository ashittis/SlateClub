"use client";

import Pill from "./Pill";

/*
  ColorChipLegend — a one-line key for the pill taxonomy.
  Surfaced once (e.g. on Settings → Appearance) so users
  can learn the silent grammar if they want to.
*/

const items: Array<{ kind: "mood" | "genre" | "language" | "platform" | "era"; label: string }> = [
  { kind: "mood", label: "mood" },
  { kind: "genre", label: "genre" },
  { kind: "language", label: "language" },
  { kind: "platform", label: "platform" },
  { kind: "era", label: "era" },
];

export default function ColorChipLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <Pill key={it.kind} kind={it.kind} interactive={false} size="sm">
          {it.label}
        </Pill>
      ))}
    </div>
  );
}
