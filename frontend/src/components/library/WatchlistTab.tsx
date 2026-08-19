"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { libraryApi, libraryKeys } from "@/lib/api/library";
import { filmHref } from "@/lib/api/films";
import EmptyState from "./EmptyState";

/** Films you mean to watch. Logging one removes it automatically — watching is
 *  terminal for "to watch". */
export default function WatchlistTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: libraryKeys.watchlist(),
    queryFn: () => libraryApi.watchlist(),
  });

  const remove = async (movieId: string) => {
    await libraryApi.removeFromWatchlist(movieId);
    queryClient.invalidateQueries({ queryKey: libraryKeys.watchlist() });
  };

  if (isLoading) return <p className="meta mt-6">Loading…</p>;
  if (!data?.length) {
    return (
      <EmptyState
        title="Nothing on your watchlist"
        hint="Add films you mean to get to. They disappear from here once you log them."
      />
    );
  }

  return (
    <ul className="mt-4 border-t-2" style={{ borderColor: "var(--edge)" }}>
      {data.map((f) => (
        <li
          key={f.tmdbId}
          className="flex items-center gap-3 border-b-2 py-2.5"
          style={{ borderColor: "var(--edge)" }}
        >
          <Link href={filmHref(f)} className="shrink-0">
            <Image
              src={tmdbImage(f.posterPath, "w200")}
              alt=""
              width={36}
              height={54}
              className="poster object-cover"
              unoptimized
            />
          </Link>
          <Link href={filmHref(f)} className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{f.title}</span>
            <span className="meta block">{f.year ?? "—"}</span>
            {f.note && (
              <span className="meta mt-0.5 block truncate" style={{ color: "var(--chalk)" }}>
                {f.note}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => remove(f.id)}
            aria-label={`Remove ${f.title} from watchlist`}
            className="min-h-[44px] shrink-0 border px-2.5 text-sm"
            style={{ borderColor: "var(--edge)", color: "var(--xerox)" }}
          >
            remove
          </button>
        </li>
      ))}
    </ul>
  );
}
