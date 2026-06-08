"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
}

export default function CirclesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const list = useQuery<{ items: Circle[] }>({
    queryKey: ["circles-mine"],
    queryFn: () => apiFetch("/api/circles/mine"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Circle>("/api/circles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["circles-mine"] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Taste Circles
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Private 2–12 person groups for close-friends film culture.
      </p>

      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <h2
          className="display text-sm font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--text-faint)" }}
        >
          New circle
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Sunday Night Cinema)"
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none mb-2"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => name.trim() && create.mutate()}
            disabled={!name.trim() || create.isPending}
            className="px-4 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50"
            style={{
              background: "var(--cta-gradient)",
              color: "var(--bg-screening)",
            }}
          >
            Create circle
          </button>
        </div>
      </div>

      {list.data && list.data.items.length === 0 && (
        <p
          className="text-sm rounded-xl p-6 text-center"
          style={{
            color: "var(--text-faint)",
            background: "var(--bg-card)",
            border: "1px dashed rgba(255,255,255,0.06)",
          }}
        >
          You haven&apos;t joined any circles yet.
        </p>
      )}

      <div className="space-y-3">
        {list.data?.items.map((c) => (
          <Link
            key={c.id}
            href={`/circles/${c.id}`}
            className="block rounded-xl p-4"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p
                  className="display font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {c.name}
                </p>
                {c.description && (
                  <p
                    className="text-sm mt-1"
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
                {c.memberCount}/{c.maxMembers}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
