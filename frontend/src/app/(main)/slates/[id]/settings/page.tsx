"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FriendMultiPicker, { type UserLite } from "@/components/match-cut/FriendMultiPicker";
import type { SlateDetail } from "@/types/slates";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SlateSettingsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const { data } = useQuery<SlateDetail>({
    queryKey: ["slate", id],
    queryFn: () => apiFetch(`/api/slates/${id}`),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [adding, setAdding] = useState<UserLite[]>([]);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setDescription(data.description ?? "");
      setVisibility(data.visibility === "private" ? "private" : "public");
    }
  }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => qc.invalidateQueries({ queryKey: ["slate", id] });

  const patchMut = useMutation({
    mutationFn: () =>
      apiFetch(`/api/slates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, visibility }),
      }),
    onSuccess: invalidate,
  });
  const addCollabMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/slates/${id}/collaborators`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: invalidate,
  });
  const removeCollabMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/slates/${id}/collaborators/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({
    mutationFn: () => apiFetch(`/api/slates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slates"] });
      router.replace("/slates");
    },
  });

  if (!data) return <div className="mx-auto max-w-2xl px-4 pt-6" />;
  if (user?.id !== data.creator?.id) {
    return (
      <p className="px-4 py-20 text-center text-sm" style={{ color: "var(--text-faint)" }}>
        Only the creator can edit this slate.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
        Slate Settings
      </h1>

      <section className="mt-6 space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Description"
          className="w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <div className="flex gap-2">
          {(["public", "private"] as const).map((v) => {
            const on = visibility === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className="flex-1 rounded-xl px-3 py-2 text-left text-sm cursor-pointer"
                style={{
                  background: on ? "rgba(255,138,0,0.15)" : "var(--bg-card)",
                  border: on ? "1px solid rgba(255,138,0,0.45)" : "1px solid rgba(255,255,255,0.08)",
                  color: "var(--text-primary)",
                }}
              >
                <span className="font-semibold">{v === "public" ? "Public" : "Private"}</span>
                <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                  {v === "public" ? "Anyone can see" : "Orbit + collaborators"}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => patchMut.mutate()}
          disabled={patchMut.isPending}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
          style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
        >
          {patchMut.isPending ? "Saving…" : "Save changes"}
        </button>
      </section>

      {/* Collaborators */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Collaborators</h2>
        {data.collaborators.length > 0 && (
          <div className="mb-3 space-y-1">
            {data.collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-2" style={{ background: "var(--bg-card)" }}>
                <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--cta-primary)", color: "var(--bg-screening)" }}>
                  {c.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.avatarUrl} alt={c.name} className="h-full w-full rounded-full object-cover" />
                  ) : (c.name[0]?.toUpperCase())}
                </span>
                <span className="flex-1 truncate text-sm" style={{ color: "var(--text-primary)" }}>{c.name}</span>
                <button onClick={() => removeCollabMut.mutate(c.id)} className="px-2 text-sm cursor-pointer" style={{ color: "var(--text-faint)" }}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <FriendMultiPicker
          meId={user?.id ?? null}
          value={adding}
          onChange={(next) => {
            // Add the newly-picked user immediately, then clear from the staging list.
            const added = next.find((u) => !adding.some((a) => a.id === u.id));
            if (added) addCollabMut.mutate(added.id);
            setAdding([]);
          }}
        />
      </section>

      {/* Danger zone */}
      <section className="mt-10">
        <button
          onClick={() => {
            if (confirm("Delete this slate? This cannot be undone.")) deleteMut.mutate();
          }}
          className="rounded-full px-5 py-2 text-sm font-semibold cursor-pointer"
          style={{ background: "rgba(220,60,60,0.15)", color: "#ff6b6b", border: "1px solid rgba(220,60,60,0.4)" }}
        >
          Delete Slate
        </button>
      </section>
    </div>
  );
}
