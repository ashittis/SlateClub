"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import SlateCard from "@/components/slates/SlateCard";
import CreateSlateModal from "@/components/slates/CreateSlateModal";
import type { SlateCard as SlateCardType } from "@/types/slates";

type Tab = "mine" | "saved" | "collaborative" | "featured";

const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "My Slates" },
  { key: "saved", label: "Saved" },
  { key: "collaborative", label: "Collaborative" },
  { key: "featured", label: "Trending" },
];

export default function SlatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("mine");
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery<{ items: SlateCardType[] }>({
    queryKey: ["slates", tab],
    queryFn: () => apiFetch(`/api/slates/${tab}`),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 pb-24">
      <div className="flex items-center justify-between mb-5">
        <h1
          className="display text-2xl lg:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Slates
        </h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-full text-sm font-semibold cursor-pointer"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
            boxShadow: "0 12px 24px -10px rgba(255, 138, 0, 0.5)",
          }}
        >
          + Create Slate
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: active ? "var(--text-primary)" : "var(--bg-card)",
                color: active ? "var(--bg-screening)" : "var(--text-muted)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-2xl animate-pulse"
              style={{ background: "var(--bg-card)" }}
            />
          ))}
        </div>
      ) : list.data && list.data.items.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.08)",
          }}
        >
          <p style={{ color: "var(--text-muted)" }} className="text-sm">
            {tab === "mine"
              ? "You haven't created any Slates yet. Build your first."
              : tab === "saved"
                ? "Save Slates from others to see them here."
                : "Nothing trending yet — it'll fill in as people save."}
          </p>
          {tab === "mine" && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-block mt-4 px-5 py-2 rounded-full text-sm font-semibold cursor-pointer"
              style={{
                background: "var(--cta-gradient)",
                color: "var(--bg-screening)",
              }}
            >
              Create a Slate
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.data?.items.map((s) => (
            <SlateCard key={s.id} slate={s} />
          ))}
        </div>
      )}

      <CreateSlateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(slate) => router.push(`/slates/${slate.id}`)}
      />
    </div>
  );
}
