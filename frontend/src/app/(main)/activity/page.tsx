"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { tmdbImage } from "@/lib/api/client";
import { activityApi, activityKeys, describeActivity } from "@/lib/api/activity";
import { formatViewingDate } from "@/lib/api/diary";
import Page from "@/components/layout/Page";

/**
 * Activity — what the people you follow have been watching.
 *
 * A dated ledger, not a social feed: no likes, no comments, no reshares. You
 * see what someone watched and you go look at the film. That's the loop.
 */
export default function ActivityPage() {
  const [scope, setScope] = useState<"network" | "world">("network");

  const { data, isLoading } = useQuery({
    queryKey: activityKeys.feed(scope),
    queryFn: () => activityApi.feed(scope),
  });

  const events = data?.events ?? [];

  return (
    <Page>
      <h1 className="text-2xl">Activity</h1>

      <div
        className="mt-4 flex gap-1 border-b"
        style={{ borderColor: "var(--edge)" }}
      >
        {(["network", "world"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className="relative min-h-[44px] px-3 text-sm font-medium"
            style={{ color: scope === s ? "var(--chalk)" : "var(--xerox)" }}
          >
            {s === "network" ? "People you follow" : "Everyone"}
            <span
              aria-hidden
              className="absolute inset-x-2 bottom-0 h-[2px]"
              style={{ background: scope === s ? "var(--blood)" : "transparent" }}
            />
          </button>
        ))}
      </div>

      {isLoading && <p className="meta mt-4">Loading…</p>}

      {!isLoading && events.length === 0 && (
        <div
          className="mt-6 border border-dashed px-4 py-12 text-center"
          style={{ borderColor: "var(--edge)" }}
        >
          <p className="text-sm font-medium">
            {scope === "network" ? "Nothing from your people yet" : "Nothing here yet"}
          </p>
          <p className="meta mt-1">
            {scope === "network"
              ? "Follow someone and their viewings show up here."
              : "Be the first to log something."}
          </p>
        </div>
      )}

      {events.length > 0 && (
        <ul className="mt-4 border-t" style={{ borderColor: "var(--edge)" }}>
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 border-b py-2.5"
              style={{ borderColor: "var(--edge)" }}
            >
              <Link href={`/passport/${e.user.username}`} className="shrink-0">
                <Image
                  src={tmdbImage(e.user.avatar_url, "w200")}
                  alt=""
                  width={32}
                  height={32}
                  className="poster h-8 w-8 rounded-full object-cover"
                  unoptimized
                />
              </Link>

              <p className="min-w-0 flex-1 text-sm">
                <Link href={`/passport/${e.user.username}`} className="font-medium">
                  {e.user.name}
                </Link>{" "}
                <span style={{ color: "var(--xerox)" }}>{describeActivity(e)}</span>{" "}
                <Link href={`/film/${e.movie.tmdbId}`} className="font-medium">
                  {e.movie.title}
                </Link>
              </p>

              <span className="meta shrink-0">
                {formatViewingDate(e.createdAt.slice(0, 10))}
              </span>

              <Link href={`/film/${e.movie.tmdbId}`} className="shrink-0">
                <Image
                  src={tmdbImage(e.movie.posterPath, "w200")}
                  alt=""
                  width={28}
                  height={42}
                  className="poster object-cover"
                  unoptimized
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
