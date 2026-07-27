"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import ForYouGrid from "@/components/feed/ForYouGrid";
import FeedScopeMood from "@/components/feed/SessionMoodBar";

/*
  /for-you — the personalised feed as a real destination (it used to be a Home
  section capped at 10, with pages 2+ unreachable). Pages through the full
  ranked list and honours the session mood.
*/
export default function ForYouPage() {
  const { user, loading } = useAuthStore();

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <p className="mb-4" style={{ color: "var(--text-muted)" }}>Log in to see your picks.</p>
        <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}>
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
      <div className="mb-2">
        <h1 className="display text-2xl lg:text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          For You
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Ranked by your taste. Set a mood to reshape the feed.
        </p>
      </div>
      <div className="mb-6">
        <FeedScopeMood />
      </div>
      <ForYouGrid variant="full" />
    </div>
  );
}
