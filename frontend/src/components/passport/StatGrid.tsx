import type { PassportStats } from "@/lib/api/passport";

/**
 * The stat block — the Passport's centrepiece.
 *
 * A ruled grid of monospace figures rather than cards: this is a record, and
 * the early-2000s treatment is a table, not a dashboard.
 *
 * `films` and `viewings` are shown separately on purpose. They diverge as soon
 * as someone rewatches, and collapsing them into one "films watched" number is
 * how a stat card ends up lying.
 */
export default function StatGrid({ stats }: { stats: PassportStats }) {
  const cells: { label: string; value: string | number }[] = [
    { label: "Films", value: stats.films },
    { label: "Viewings", value: stats.viewings },
    { label: "Rewatches", value: stats.rewatches },
    { label: "In theatres", value: stats.theatreVisits },
    { label: "Hours", value: stats.hoursWatched },
    { label: "Avg rating", value: stats.averageRating ?? "—" },
    { label: "Reviews", value: stats.reviews },
    { label: "Watchlist", value: stats.watchlist },
  ];

  return (
    <dl
      className="mt-5 grid grid-cols-4 border-l border-t"
      style={{ borderColor: "var(--edge)" }}
    >
      {cells.map((c) => (
        <div
          key={c.label}
          className="border-b border-r px-2 py-2.5"
          style={{ borderColor: "var(--edge)" }}
        >
          <dd className="text-lg font-bold leading-none tabular-nums">{c.value}</dd>
          <dt className="section-label mt-1 block">{c.label}</dt>
        </div>
      ))}
    </dl>
  );
}
