"use client";

import type { PostType } from "@/types/posts";
import { tokens } from "@/lib/design-tokens";

/*
  PostTypeBadge — colour-coded flair for a post's kind (spec §5). Colours
  follow the pill taxonomy so the category reads without a legend. "text"
  is treated as a plain post and shows no badge.
*/

const META: Record<PostType, { label: string; color: string } | null> = {
  text: null,
  question: { label: "Question", color: tokens.cta.primary },
  discussion: { label: "Discussion", color: tokens.pill.genre },
  review: { label: "Review", color: tokens.pill.mood },
  news: { label: "News", color: tokens.pill.platform },
  fan_theory: { label: "Fan Theory", color: tokens.pill.era },
  meme: { label: "Meme", color: tokens.pill.language },
  poll: { label: "Poll", color: tokens.nav.active },
};

export default function PostTypeBadge({ type }: { type: PostType }) {
  const meta = META[type];
  if (!meta) return null;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: hexA(meta.color, 0.16), color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}
