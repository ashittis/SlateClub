"use client";

export interface AwardItem {
  slug: string;
  label: string;
  year: number;
}

interface Props {
  items: AwardItem[];
}

export default function AwardRow({ items }: Props) {
  return (
    <div className="no-scrollbar -mx-4 px-4 overflow-x-auto pb-2 lg:overflow-visible">
      <div className="flex gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-6">
        {items.map((a) => (
          <button
            key={a.slug}
            className="shrink-0 lg:shrink rounded-xl px-4 py-3 text-left min-w-[180px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(110,91,168,0.7), rgba(110,91,168,0.25))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p
              className="display text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {a.label}
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
              {a.year}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
