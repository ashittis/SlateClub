"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiFetch } from "../../lib/api";
import Pill from "@/components/ui/Pill";

interface TasteAxis {
  dimension: string;
  position: string;
  strength: number;
}

interface DirectorAffinity {
  name: string;
  affinity: number;
}

interface TasteIdentity {
  primary_axes: TasteAxis[];
  genre_blend: string;
  director_affinities: DirectorAffinity[];
  taste_statement: string;
  tribes: string[];
}

export default function TasteIdentityCard() {
  const { data, isLoading } = useQuery<{ identity: TasteIdentity }>({
    queryKey: ["taste-identity"],
    queryFn: () => apiFetch("/api/taste/identity"),
  });

  if (isLoading) {
    return (
      <div
        className="animate-pulse space-y-3 rounded-xl p-5"
        style={{ background: "var(--bg-card)" }}
      >
        <div className="h-5 w-40 rounded" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-16 rounded" style={{ background: "var(--bg-elevated)" }} />
        <div className="h-4 w-3/4 rounded" style={{ background: "var(--bg-elevated)" }} />
      </div>
    );
  }

  const identity = data?.identity;
  if (!identity) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/5 p-5 space-y-4"
      style={{ background: "var(--bg-card)" }}
    >
      <h3 className="text-lg font-bold display" style={{ color: "var(--text-primary)" }}>
        Your Cinematic Identity
      </h3>

      <p className="font-semibold text-sm" style={{ color: "var(--cta-primary)" }}>
        {identity.genre_blend}
      </p>

      {identity.primary_axes.length > 0 && (
        <div className="space-y-2">
          {identity.primary_axes.map((axis) => (
            <div key={axis.dimension} className="flex items-center gap-3">
              <span
                className="text-xs w-20 capitalize"
                style={{ color: "var(--text-faint)" }}
              >
                {axis.dimension}:
              </span>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: "var(--bg-elevated)" }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${axis.strength * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: "var(--cta-primary)" }}
                />
              </div>
              <span className="text-xs w-24" style={{ color: "var(--text-muted)" }}>
                {axis.position}
              </span>
            </div>
          ))}
        </div>
      )}

      <p
        className="text-sm italic leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        &ldquo;{identity.taste_statement}&rdquo;
      </p>

      {identity.director_affinities.length > 0 && (
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>
            Top affinities
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {identity.director_affinities.map((d) => d.name).join(" · ")}
          </p>
        </div>
      )}

      {identity.tribes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {identity.tribes.map((tribe) => (
            <Pill key={tribe} kind="genre" interactive={false} size="sm">
              {tribe}
            </Pill>
          ))}
        </div>
      )}
    </motion.div>
  );
}
