"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Props {
  username: string;
  /** When true, also renders raw stats next to the badge. */
  showStats?: boolean;
}

interface CriticCheck {
  isCritic: boolean;
  reviewCountLast30d: number;
  medianHelpful: number;
}

/*
  CriticBadge — only renders if the user currently meets the
  algorithmic critic threshold. Cheap; cached for 10 min.
*/
export default function CriticBadge({ username, showStats }: Props) {
  const { data } = useQuery<CriticCheck>({
    queryKey: ["critic-check", username],
    queryFn: () => apiFetch(`/api/critics/check/${username}`),
    staleTime: 10 * 60_000,
  });

  if (!data?.isCritic) return null;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        background: "rgba(184,149,106,0.18)",
        color: "var(--pill-language)",
        border: "1px solid rgba(184,149,106,0.45)",
      }}
      title="Critic — sustained helpful reviews over the last 30 days"
    >
      ✦ Critic
      {showStats && (
        <span style={{ color: "var(--text-faint)" }}>
          · {data.reviewCountLast30d} reviews · med {data.medianHelpful}
        </span>
      )}
    </span>
  );
}
