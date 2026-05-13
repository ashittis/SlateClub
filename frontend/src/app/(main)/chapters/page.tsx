"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface ChapterCard {
  slug: string;
  name: string;
  city: string;
  description: string | null;
  memberCount: number;
}

export default function ChaptersPage() {
  const [city, setCity] = useState("");
  const list = useQuery<{ items: ChapterCard[] }>({
    queryKey: ["chapters", city],
    queryFn: () =>
      apiFetch(`/api/chapters${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Local Chapters
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        City communities for screenings, meetups, and local cinema culture.
      </p>

      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Filter by city (e.g. Hyderabad)"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-5"
        style={{
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      {list.data && list.data.items.length === 0 && (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          No chapters here yet. Be the first.
        </p>
      )}

      <div className="space-y-3">
        {list.data?.items.map((c) => (
          <Link
            key={c.slug}
            href={`/chapters/${c.slug}`}
            className="block rounded-xl p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="display font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {c.name}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-faint)" }}
                >
                  {c.city}
                </p>
                {c.description && (
                  <p
                    className="text-sm mt-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {c.description}
                  </p>
                )}
              </div>
              <span
                className="text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                {c.memberCount} members
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
