"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { reviewKeys, reviewsApi } from "@/lib/api/reviews";
import { formatViewingDate } from "@/lib/api/diary";
import StarRating from "@/components/ratings/StarRating";

/**
 * Community reviews on the film page (KASET.md §8).
 *
 * Each review shows the author's rating beside it — a review reads very
 * differently next to the score it came with, and separating them is how a
 * three-star review gets mistaken for a pan.
 *
 * Spoilers are hidden behind a click rather than a warning label. A warning you
 * have already read is not a warning.
 */
export default function CommunityReviews({ filmId }: { filmId: string | undefined }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: reviewKeys.forFilm(filmId ?? ""),
    queryFn: () => reviewsApi.forFilm(filmId!),
    enabled: !!filmId,
  });

  const markHelpful = async (reviewId: string) => {
    await reviewsApi.markHelpful(reviewId);
    queryClient.invalidateQueries({ queryKey: reviewKeys.forFilm(filmId ?? "") });
  };

  if (!filmId || isLoading) return null;
  if (!data?.length) {
    return (
      <section className="mt-7">
        <h2 className="section-label">Reviews</h2>
        <p className="meta mt-2">No one has written about this yet.</p>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <h2 className="section-label">
        Reviews · {data.length}
      </h2>
      <ul className="mt-2 border-t-2" style={{ borderColor: "var(--edge)" }}>
        {data.map((r) => (
          <li key={r.id} className="border-b-2 py-3" style={{ borderColor: "var(--edge)" }}>
            <div className="flex items-center gap-2">
              <Link href={`/passport/${r.author.username}`} className="shrink-0">
                <Image
                  src={tmdbImage(r.author.avatarUrl, "w200")}
                  alt=""
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                  unoptimized
                />
              </Link>
              <Link href={`/passport/${r.author.username}`} className="text-sm font-medium">
                {r.author.name}
              </Link>
              {r.rating !== null && <StarRating value={r.rating} readonly size="sm" />}
              <span className="meta ml-auto">
                {formatViewingDate(r.createdAt.slice(0, 10))}
              </span>
            </div>

            <ReviewBody body={r.body} spoiler={r.spoiler} />

            <button
              type="button"
              onClick={() => markHelpful(r.id)}
              className="meta mt-1.5"
              style={{ color: "var(--blood-ink)" }}
            >
              helpful{r.helpfulCount > 0 ? ` · ${r.helpfulCount}` : ""}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewBody({ body, spoiler }: { body: string; spoiler: boolean }) {
  const [revealed, setRevealed] = useState(false);

  if (spoiler && !revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="mt-1.5 w-full border border-dashed py-3 text-center"
        style={{ borderColor: "var(--edge)" }}
      >
        <span className="meta">contains spoilers — tap to read</span>
      </button>
    );
  }
  return (
    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
  );
}
