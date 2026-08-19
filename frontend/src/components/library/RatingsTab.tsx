"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { libraryApi, libraryKeys } from "@/lib/api/library";
import { filmHref } from "@/lib/api/films";
import StarRating from "@/components/ratings/StarRating";
import EmptyState from "./EmptyState";

/** Everything you've rated, highest-recent first. A poster grid — here you
 *  scan by film, not by date. */
export default function RatingsTab() {
  const { data, isLoading } = useQuery({
    queryKey: libraryKeys.ratings(),
    queryFn: () => libraryApi.ratings(),
  });

  if (isLoading) return <p className="meta mt-6">Loading…</p>;
  if (!data?.length) {
    return (
      <EmptyState
        title="You haven't rated anything yet"
        hint="Rate a film from its page, or while logging it."
      />
    );
  }

  return (
    <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {data.map((f) => (
        <li key={f.tmdbId}>
          <Link href={filmHref(f)} className="block">
            <Image
              src={tmdbImage(f.posterPath, "w200")}
              alt={f.title}
              width={120}
              height={180}
              className="poster w-full object-cover"
              unoptimized
            />
            <span className="mt-1 block truncate text-xs font-medium">{f.title}</span>
            <span className="mt-0.5 block">
              <StarRating value={f.rating} readonly size="sm" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
