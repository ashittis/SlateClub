"use client";

import { WATCH_TYPES, WATCH_TYPE_LABELS, type WatchType } from "@/lib/api/diary";
import { OtherIcon, StreamingIcon, TheatreIcon, TvIcon } from "./logIcons";

const ICONS: Record<WatchType, (p: { className?: string }) => React.ReactElement> = {
  theatre: TheatreIcon,
  streaming: StreamingIcon,
  tv: TvIcon,
  other: OtherIcon,
};

/**
 * How you watched it — four icons, one selected.
 *
 * Choosing Theatre no longer opens a sub-form asking for the cinema's name and
 * city. Recording *that you went* is the part people actually want, and the
 * three optional text fields turned a two-tap action into paperwork. The
 * columns still exist on the entry for the Letterboxd importer and for older
 * viewings that carry the detail.
 */
export default function WatchMethodPicker({
  value,
  onChange,
}: {
  value: WatchType;
  onChange: (next: WatchType) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {WATCH_TYPES.map((type) => {
        const Icon = ICONS[type];
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(type)}
            className="flex min-h-[60px] flex-col items-center justify-center gap-1 border px-1 py-2 transition-colors"
            style={{
              borderColor: selected ? "var(--chalk)" : "var(--edge)",
              background: selected ? "var(--chalk)" : "var(--void)",
              color: selected ? "var(--soot)" : "var(--xerox)",
            }}
          >
            <Icon />
            <span
              className="section-label"
              style={{ color: selected ? "var(--soot)" : "var(--faint)" }}
            >
              {WATCH_TYPE_LABELS[type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
