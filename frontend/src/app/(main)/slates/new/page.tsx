"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SlateCard, SlateVisibility } from "@/types/slates";

export default function NewSlatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<SlateVisibility>("public");

  const createMut = useMutation<SlateCard, Error, void>({
    mutationFn: () =>
      apiFetch<SlateCard>("/api/slates", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          visibility,
        }),
      }),
    onSuccess: (slate) => {
      router.push(`/slates/${slate.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 lg:px-6 pt-8 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        Create a Slate
      </h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        A Slate is a curated film collection. You can add films and notes after.
      </p>

      <div className="mt-8 space-y-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Korean Slow Burns"
            className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What ties these films together?"
            className="w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none resize-none"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
        </Field>

        <Field label="Visibility">
          <div className="grid grid-cols-3 gap-2">
            {(["public", "unlisted", "private"] as SlateVisibility[]).map((v) => {
              const active = visibility === v;
              return (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold capitalize"
                  style={{
                    background: active ? "var(--cta-primary)" : "var(--bg-card)",
                    color: active ? "var(--bg-screening)" : "var(--text-muted)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </Field>

        {createMut.isError && (
          <p className="text-sm" style={{ color: "var(--signal-error)" }}>
            {createMut.error.message}
          </p>
        )}

        <button
          onClick={() => createMut.mutate()}
          disabled={!title.trim() || createMut.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{
            background: title.trim() ? "var(--cta-primary)" : "var(--bg-elevated)",
            color: title.trim() ? "var(--bg-screening)" : "var(--text-faint)",
            cursor: title.trim() ? "pointer" : "not-allowed",
          }}
        >
          {createMut.isPending ? "Creating…" : "Create Slate →"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs uppercase tracking-wider mb-2"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
