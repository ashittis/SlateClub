/** Small date/relative-time helpers shared across profile surfaces. */

export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w}w ago`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m}mo ago`; }
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Split an ISO date into a compact "DAY / MON" pair for diary rows. */
export function diaryDayParts(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { day: "2-digit" }),
    month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
  };
}
