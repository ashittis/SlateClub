"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/*
  FeedRow — the standard titled horizontal rail used across Home and
  Film Detail. Standardises the "no-scrollbar -mx-4 px-4 overflow-x-auto"
  pattern that was copy-pasted into DiscoverRows, SimilarAnswer and RankedRow.

  Children are laid out in a horizontal flex track; each child should be a
  shrink-0 card of a fixed width.
*/

interface FeedRowProps {
  title: string;
  subtitle?: string;
  /** Optional "See all" destination shown on the right of the header. */
  seeAllHref?: string;
  children: ReactNode;
  className?: string;
}

export default function FeedRow({
  title,
  subtitle,
  seeAllHref,
  children,
  className = "",
}: FeedRowProps) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2
            className="display truncate text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-xs font-medium hover:opacity-80"
            style={{ color: "var(--text-muted)" }}
          >
            See all
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-4">{children}</div>
      </div>
    </section>
  );
}
