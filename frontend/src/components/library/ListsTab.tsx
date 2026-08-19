"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { collectionKeys, watchlistsApi } from "@/lib/api/collections";
import EmptyState from "./EmptyState";

/**
 * Named watchlists — collections the user made on purpose.
 *
 * Separate from the Watchlist tab, which is the single implicit "save for
 * later" list. A themed collection isn't a statement of intent to watch next.
 */
export default function ListsTab() {
  const { data, isLoading } = useQuery({
    queryKey: collectionKeys.watchlists(),
    queryFn: () => watchlistsApi.mine(),
  });

  if (isLoading) return <p className="meta mt-6">Loading…</p>;
  if (!data?.length) {
    return (
      <EmptyState
        title="No lists yet"
        hint="Group films however you like — by mood, by year, by who you're watching with."
        cta={{ label: "Create a list", href: "/create/watchlist" }}
      />
    );
  }

  return (
    <ul className="mt-4 border-t" style={{ borderColor: "var(--edge)" }}>
      {data.map((wl) => (
        <li key={wl.id} className="border-b" style={{ borderColor: "var(--edge)" }}>
          <Link
            href={`/library/watchlists/${wl.id}`}
            className="flex min-h-[68px] items-center gap-3 py-2.5"
          >
            {/* Poster collage — four covers, or a placeholder block. */}
            <span className="flex shrink-0 gap-0.5">
              {(wl.covers.length ? wl.covers : [null]).slice(0, 4).map((c, i) => (
                <Image
                  key={i}
                  src={tmdbImage(c, "w200")}
                  alt=""
                  width={26}
                  height={39}
                  className="poster object-cover"
                  unoptimized
                />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{wl.title}</span>
              <span className="meta block">
                {wl.filmCount} {wl.filmCount === 1 ? "film" : "films"}
                {wl.visibility === "private" && " · private"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
