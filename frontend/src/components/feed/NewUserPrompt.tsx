"use client";

import Link from "next/link";

/*
  NewUserPrompt — cold-start card shown on Home when the user hasn't rated
  enough films for the taste engine to personalise. Replaces the
  personalization-dependent rows per the spec's new-user empty state.
*/

export default function NewUserPrompt() {
  return (
    <div
      className="flex flex-col items-center rounded-2xl px-6 py-12 text-center"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <h2 className="display text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Rate a few films to get started
      </h2>
      <p className="mt-2 max-w-md text-sm" style={{ color: "var(--text-muted)" }}>
        The taste engine learns from what you love. Rate five or so films and
        your personalised rows — Made for you, Because you watched, Match Cuts —
        light up.
      </p>
      <div className="mt-5 flex gap-3">
        <Link
          href="/search"
          className="rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}
        >
          Find films to rate
        </Link>
        <Link
          href="/onboarding/posters"
          className="rounded-full px-5 py-2 text-sm font-semibold"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          Pick from favourites
        </Link>
      </div>
    </div>
  );
}
