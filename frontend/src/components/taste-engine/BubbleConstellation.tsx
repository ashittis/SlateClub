"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { tmdbImage } from "@/lib/api";

export interface ConstellationFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  relevanceScore: number; // 0..1
}

interface Props {
  films: ConstellationFilm[];
  height?: number;
}

interface Node {
  id: number;
  x: number;
  y: number;
  r: number;
  film: ConstellationFilm;
}

/*
  BubbleConstellation — circular posters scattered organically,
  sized by relevance. Layout uses an iterative collision-resolve
  pass (no d3 dep). Position freezes after settle.
*/
export default function BubbleConstellation({ films, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodes = useMemo<Node[]>(() => {
    if (!films.length) return [];
    const w = Math.max(width, 260);
    const h = height;

    // Diameter scales 56..130 by relevance.
    const initial = films.map((f, i) => {
      const r = 28 + Math.round(f.relevanceScore * 37);
      // Seed positions on a circle so settle is fast.
      const angle = (i / films.length) * Math.PI * 2;
      const radius = Math.min(w, h) * 0.32;
      return {
        id: f.tmdbId,
        x: w / 2 + Math.cos(angle) * radius,
        y: h / 2 + Math.sin(angle) * radius,
        r,
        film: f,
      };
    });

    // Iterative settle: gravity to centre + collision pushback.
    const cx = w / 2;
    const cy = h / 2;
    const ITERS = 220;
    for (let it = 0; it < ITERS; it++) {
      // gravity
      for (const n of initial) {
        const dx = cx - n.x;
        const dy = cy - n.y;
        n.x += dx * 0.012;
        n.y += dy * 0.012;
      }
      // collisions
      for (let i = 0; i < initial.length; i++) {
        for (let j = i + 1; j < initial.length; j++) {
          const a = initial[i];
          const b = initial[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const min = a.r + b.r + 6;
          if (d < min) {
            const push = (min - d) / 2;
            const ux = dx / d;
            const uy = dy / d;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
      // bound
      for (const n of initial) {
        n.x = Math.max(n.r + 4, Math.min(w - n.r - 4, n.x));
        n.y = Math.max(n.r + 4, Math.min(h - n.r - 4, n.y));
      }
    }
    return initial;
  }, [films, width, height]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        height,
        background:
          "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(196,113,110,0.18) 0%, rgba(10,10,11,0) 65%), var(--bg-screening)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {nodes.map((n, i) => {
        const src = n.film.posterPath ? tmdbImage(n.film.posterPath, "w300") : null;
        const isActive = active === n.id;
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.02, 0.6) }}
            style={{
              position: "absolute",
              left: n.x - n.r,
              top: n.y - n.r,
              width: n.r * 2,
              height: n.r * 2,
            }}
          >
            <button
              onClick={() => setActive(isActive ? null : n.id)}
              className="relative w-full h-full rounded-full overflow-hidden transition-transform duration-200"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? "0 0 0 4px rgba(92,165,114,0.45), 0 24px 48px -16px rgba(0,0,0,0.6)"
                  : "0 12px 28px -12px rgba(0,0,0,0.65)",
                transform: isActive ? "scale(1.06)" : "scale(1)",
              }}
            >
              {src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt={n.film.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] px-2 text-center"
                  style={{ color: "var(--text-faint)" }}
                >
                  {n.film.title}
                </span>
              )}
            </button>
            {isActive && (
              <Link
                href={`/film/${n.film.tmdbId}`}
                className="absolute left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap"
                style={{
                  top: "100%",
                  background: "var(--bg-card)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--text-primary)",
                  boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
                }}
              >
                {n.film.title}
                {n.film.releaseDate && (
                  <span style={{ color: "var(--text-faint)" }}>
                    {" · " + n.film.releaseDate.slice(0, 4)}
                  </span>
                )}
              </Link>
            )}
          </motion.div>
        );
      })}
      {films.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm"
          style={{ color: "var(--text-faint)" }}
        >
          Tweak the sentence to see films appear.
        </div>
      )}
    </div>
  );
}
