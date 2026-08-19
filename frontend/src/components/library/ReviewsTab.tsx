"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { libraryApi, libraryKeys } from "@/lib/api/library";
import { filmHref } from "@/lib/api/films";
import { formatViewingDate } from "@/lib/api/diary";
import StarRating from "@/components/ratings/StarRating";
import EmptyState from "./EmptyState";

/** Everything you've written. Each review shows the rating it came with —
 *  the two are read together or not at all. */
export default function ReviewsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: libraryKeys.reviews(),
    queryFn: () => libraryApi.reviews(),
  });

  const remove = async (reviewId: string) => {
    await libraryApi.deleteReview(reviewId);
    queryClient.invalidateQueries({ queryKey: libraryKeys.reviews() });
  };

  if (isLoading) return <p className="meta mt-6">Loading…</p>;
  if (!data?.length) {
    return (
      <EmptyState
        title="You haven't written any reviews"
        hint="Add one while logging a film, or from the film's page."
      />
    );
  }

  return (
    <ul className="mt-4 space-y-4">
      {data.map((r) => (
        <li key={r.id} className="border-b pb-4" style={{ borderColor: "var(--edge)" }}>
          <div className="flex gap-3">
            <Link href={filmHref(r)} className="shrink-0">
              <Image
                src={tmdbImage(r.posterPath, "w200")}
                alt=""
                width={44}
                height={66}
                className="poster object-cover"
                unoptimized
              />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={filmHref(r)}>
                <span className="text-sm font-medium">{r.title}</span>
                {r.year && <span className="meta ml-1.5">{r.year}</span>}
              </Link>
              <div className="mt-0.5 flex items-center gap-2">
                {r.rating ? <StarRating value={r.rating} readonly size="sm" /> : null}
                <span className="meta">{formatViewingDate(r.createdAt.slice(0, 10))}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                {r.body}
              </p>
              {r.spoiler && <p className="meta mt-1">marked as containing spoilers</p>}
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="meta mt-2"
                style={{ color: "var(--blood-ink)" }}
              >
                delete review
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
