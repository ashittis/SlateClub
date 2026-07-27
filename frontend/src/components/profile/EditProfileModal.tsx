"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/user";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

const BIO_MAX = 160;
const USERNAME_RE = /^[a-zA-Z0-9_.]{2,30}$/;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Field row with label + optional hint. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
          {label}
        </span>
        {hint && <span className="text-xs" style={{ color: "var(--text-faint)" }}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cta-primary)]/50";
const inputStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "var(--text-primary)",
};

export default function EditProfileModal({ isOpen, onClose }: Props) {
  const { user, fetchUser } = useAuthStore();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const usernameValid = USERNAME_RE.test(username);
  const canSave =
    name.trim().length > 0 &&
    usernameValid &&
    bio.length <= BIO_MAX &&
    !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<User>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        }),
      });
      await fetchUser();
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile");
      setSaving(false);
    }
  }

  const initial = (name.trim()[0] ?? user.name[0] ?? "?").toUpperCase();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit profile">
      <div className="space-y-5">
        {/* Avatar preview + URL */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-glass-8 text-xl font-bold text-glass-55">
            {avatarUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl.trim()} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Field label="Avatar URL">
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className={inputCls}
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className={inputCls}
            style={inputStyle}
          />
        </Field>

        <Field label="Username" hint={usernameValid || username.length === 0 ? undefined : "letters, numbers, . or _"}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-faint)" }}>@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              maxLength={30}
              className={inputCls + " pl-7"}
              style={inputStyle}
            />
          </div>
        </Field>

        <Field label="Bio" hint={`${bio.length}/${BIO_MAX}`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={3}
            placeholder="A line about your taste…"
            className={inputCls + " resize-none"}
            style={inputStyle}
          />
        </Field>

        {error && (
          <p className="text-sm" style={{ color: "var(--signal-error)" }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
