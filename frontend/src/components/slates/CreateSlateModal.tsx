"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import FriendMultiPicker, {
  type UserLite,
} from "@/components/match-cut/FriendMultiPicker";
import type { SlateCard } from "@/types/slates";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the created slate; if omitted, the modal just closes. */
  onCreated?: (slate: SlateCard) => void;
}

/*
  Create Slate — Title, Description, Visibility (Public/Private), Collaborators.
  Private = visible to creator + collaborators + orbit; Public = everyone
  (changeable later in Slate Settings).
*/
export default function CreateSlateModal({ open, onClose, onCreated }: Props) {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [collaborators, setCollaborators] = useState<UserLite[]>([]);

  const create = useMutation({
    mutationFn: () =>
      apiFetch<SlateCard>("/api/slates", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          visibility,
          collaboratorIds: collaborators.map((c) => c.id),
        }),
      }),
    onSuccess: (slate) => {
      qc.invalidateQueries({ queryKey: ["slates"] });
      reset();
      onCreated?.(slate);
      onClose();
    },
  });

  function reset() {
    setTitle("");
    setDescription("");
    setVisibility("public");
    setCollaborators([]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Create Slate
        </h3>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. Best Korean Thrillers"
          autoFocus
          className="mt-4 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="mt-3 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.08)" }}
        />

        {/* Visibility */}
        <p className="mt-4 mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Visibility
        </p>
        <div className="flex gap-2">
          {(["public", "private"] as const).map((v) => {
            const on = visibility === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className="flex-1 rounded-xl px-3 py-2 text-left text-sm transition-colors cursor-pointer"
                style={{
                  background: on ? "rgba(255,138,0,0.15)" : "var(--bg-elevated)",
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

        {/* Collaborators */}
        <p className="mt-4 mb-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          Collaborators (optional)
        </p>
        <FriendMultiPicker
          meId={user?.id ?? null}
          value={collaborators}
          onChange={setCollaborators}
        />

        <div className="mt-5 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="text-sm transition-opacity hover:opacity-80 cursor-pointer"
            style={{ color: "var(--text-faint)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => title.trim() && create.mutate()}
            disabled={!title.trim() || create.isPending}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            style={{ background: "var(--cta-gradient)", boxShadow: "var(--cta-glow)" }}
          >
            {create.isPending ? "Creating…" : "Create Slate"}
          </button>
        </div>
      </div>
    </div>
  );
}
