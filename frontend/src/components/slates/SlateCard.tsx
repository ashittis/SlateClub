"use client";

import Link from "next/link";
import CardStack from "@/components/ui/CardStack";
import { tmdbImage } from "@/lib/api";
import type { SlateCard as SlateCardType } from "@/types/slates";

interface Props {
  slate: SlateCardType;
}

export default function SlateCard({ slate }: Props) {
  const posters = slate.coverPosters.map((p) => tmdbImage(p, "w300"));
  while (posters.length < 4) posters.push("");
  const variant = slate.coverLayout;
  const variantNorm =
    variant === "stack_3" ? "fan" : variant === "spiral" ? "spiral" : "mosaic";

  return (
    <Link
      href={`/slates/${slate.id}`}
      className="block rounded-2xl overflow-hidden p-4 transition-all hover:opacity-95"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex justify-center mb-3">
        <CardStack posters={posters} variant={variantNorm} size="sm" alt={slate.title} />
      </div>
      <h3
        className="display text-base font-bold truncate"
        style={{ color: "var(--text-primary)" }}
      >
        {slate.title}
      </h3>
      <p
        className="text-xs mt-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {slate.creator?.name ?? "—"} · {slate.filmCount} film
        {slate.filmCount === 1 ? "" : "s"}
      </p>
      {slate.saveCount > 0 && (
        <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
          ♡ {slate.saveCount}
        </p>
      )}
    </Link>
  );
}
