"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch, tmdbImage } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FeedRow from "@/components/ui/FeedRow";
import RankedOverlay from "@/components/ui/RankedOverlay";

/*
  "Trending near you" — the spec's full ranked row (promoted from the home
  sidebar). Rank-badge poster cards from /api/feed/city-trending. Hidden
  until the user's city resolves and has titles.
*/

interface CityTrendingItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  viewers: number;
}

interface CityTrending {
  resolved: boolean;
  city: string | null;
  items: CityTrendingItem[];
}

export default function TrendingNearYouRow() {
  const { user } = useAuthStore();
  const { data } = useQuery<CityTrending>({
    queryKey: ["city-trending"],
    queryFn: () => apiFetch("/api/feed/city-trending"),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  if (!data?.resolved || data.items.length === 0) return null;

  return (
    <FeedRow title={data.city ? `Trending in ${data.city}` : "Trending near you"}>
      {data.items.slice(0, 10).map((it, i) => (
        <motion.div key={it.tmdbId} whileHover={{ scale: 1.03 }} className="shrink-0 w-[150px]">
          <Link href={`/film/${it.tmdbId}`} className="block">
            <div
              className="relative aspect-[2/3] w-full overflow-hidden rounded-xl"
              style={{ background: "var(--bg-elevated)" }}
            >
              {it.posterPath ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={tmdbImage(it.posterPath, "w300")}
                  alt={it.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
              <RankedOverlay rank={i + 1} />
            </div>
            <p
              className="mt-3 truncate pl-9 text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {it.title}
            </p>
            <p className="pl-9 text-xs" style={{ color: "var(--text-faint)" }}>
              {it.viewers} watching nearby
            </p>
          </Link>
        </motion.div>
      ))}
    </FeedRow>
  );
}
