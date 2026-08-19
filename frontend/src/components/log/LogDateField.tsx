"use client";

import { formatViewingDate, todayISO } from "@/lib/api/diary";
import { CalendarIcon } from "./logIcons";

/** YYYY-MM-DD for N days before today, in the viewer's own timezone. */
function daysAgoISO(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * When you watched it.
 *
 * Almost every log is today or yesterday, so both are one tap. The native date
 * input stays underneath — it is the whole control's click target — because it
 * brings the OS picker on mobile and keyboard entry on desktop, and nothing
 * hand-rolled would match either. What's drawn on top is the mono date the rest
 * of the diary uses, since the browser's own rendering is locale-shaped and
 * would be the one place a date looks different.
 */
export default function LogDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const today = todayISO();
  const yesterday = daysAgoISO(1);

  const quick = [
    { label: "Today", iso: today },
    { label: "Yesterday", iso: yesterday },
  ];

  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      <div
        className="relative flex min-h-[48px] flex-1 items-center gap-2.5 border px-3"
        style={{ borderColor: "var(--edge)", background: "var(--void)" }}
      >
        <CalendarIcon className="shrink-0" />
        <span className="meta" style={{ color: "var(--chalk)" }}>
          {formatViewingDate(value)}
        </span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Date watched"
          // Covers the cell and is invisible, so the native picker opens from
          // anywhere in the field while the mono date above stays the visible layer.
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      {quick.map(({ label, iso }) => {
        const selected = value === iso;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(iso)}
            className="section-label min-h-[48px] border px-3 transition-colors"
            style={{
              borderColor: selected ? "var(--chalk)" : "var(--edge)",
              background: selected ? "var(--chalk)" : "var(--void)",
              color: selected ? "var(--soot)" : "var(--xerox)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
