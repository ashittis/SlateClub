import type { Metadata } from "next";
import Link from "next/link";
import Page from "@/components/layout/Page";

export const metadata: Metadata = { title: "Create" };

/**
 * Create — exactly two things in V1 (KASET.md §8). Both land in Phase 9; this
 * page exists now so the fourth nav destination is real rather than a dead link.
 */
const OPTIONS = [
  {
    href: "/create/watchlist",
    title: "Watchlist",
    blurb: "A collection of films to watch. Name it, fill it, share it.",
  },
  {
    href: "/create/blend",
    title: "Blend",
    blurb: "Combine your taste with someone else's and see what you'd both love.",
  },
];

export default function CreatePage() {
  return (
    <Page width="narrow">
      <h1 className="text-2xl">Create</h1>
      <p className="meta mt-1">Start something new</p>

      <ul className="mt-6 border-t" style={{ borderColor: "var(--edge)" }}>
        {OPTIONS.map((o) => (
          <li key={o.href} className="border-b" style={{ borderColor: "var(--edge)" }}>
            <Link
              href={o.href}
              className="flex min-h-[72px] flex-col justify-center gap-1 py-4"
            >
              <span className="text-base font-semibold">{o.title}</span>
              <span className="text-sm" style={{ color: "var(--xerox)" }}>
                {o.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="meta mt-6">Coming in phase 9</p>
    </Page>
  );
}
