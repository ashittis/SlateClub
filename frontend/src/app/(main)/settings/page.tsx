"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import ColorChipLegend from "@/components/ui/ColorChipLegend";

interface Preferences {
  notifOptOut: string[];
  profileVisibility: "public" | "followers" | "private";
  twinMatchingEnabled: boolean;
}

const NOTIF_KINDS: Array<{ key: string; label: string }> = [
  { key: "follow", label: "Follows" },
  { key: "review_helpful", label: "Review marked helpful" },
  { key: "slate_save", label: "Someone saved your slate" },
  { key: "slate_message", label: "Slate Room messages" },
  { key: "twin_activity", label: "Twin activity" },
  { key: "release", label: "Releases on your watchlist" },
  { key: "artist", label: "Artists you follow post" },
  { key: "ama", label: "AMAs" },
  { key: "hidden_gem", label: "Hidden gem alerts" },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user, logout } = useAuthStore();
  const prefs = useQuery<Preferences>({
    queryKey: ["preferences"],
    queryFn: () => apiFetch("/api/users/me/preferences"),
  });

  const update = useMutation({
    mutationFn: (next: Partial<Preferences>) =>
      apiFetch<Preferences>("/api/users/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          notif_opt_out: next.notifOptOut,
          profile_visibility: next.profileVisibility,
          twin_matching_enabled: next.twinMatchingEnabled,
        }),
      }),
    onSuccess: (data) => qc.setQueryData(["preferences"], data),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 pb-24">
      <h1
        className="display text-2xl lg:text-3xl font-bold tracking-tight mb-6"
        style={{ color: "var(--text-primary)" }}
      >
        Settings
      </h1>

      <Section title="Account">
        <Row label="Name">
          <span style={{ color: "var(--text-primary)" }}>{user?.name}</span>
        </Row>
        <Row label="Username">
          <span style={{ color: "var(--text-primary)" }}>@{user?.username}</span>
        </Row>
        <Row label="Email">
          <span style={{ color: "var(--text-muted)" }}>{user?.email}</span>
        </Row>
        <Row label="Sign out">
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-md text-xs"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Sign out
          </button>
        </Row>
      </Section>

      <Section title="Taste profile">
        <Link
          href="/onboarding/welcome"
          className="text-sm font-medium"
          style={{ color: "var(--cta-primary)" }}
        >
          Re-run onboarding →
        </Link>
        <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
          Walk through the 8 steps again to refresh your taste signals.
        </p>
        <div className="mt-4">
          <Link
            href="/settings/import"
            className="text-sm font-medium"
            style={{ color: "var(--cta-primary)" }}
          >
            Import from Letterboxd →
          </Link>
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            Bulk-seed ratings, watch history, and watchlist from a CSV export.
          </p>
        </div>
      </Section>

      <Section title="Notifications">
        {prefs.isLoading || !prefs.data ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Loading…
          </p>
        ) : (
          <div className="space-y-2">
            {NOTIF_KINDS.map((k) => {
              const optedOut = prefs.data!.notifOptOut.includes(k.key);
              return (
                <Toggle
                  key={k.key}
                  label={k.label}
                  on={!optedOut}
                  onChange={(on) => {
                    const next = on
                      ? prefs.data!.notifOptOut.filter((x) => x !== k.key)
                      : [...prefs.data!.notifOptOut, k.key];
                    update.mutate({ notifOptOut: next });
                  }}
                />
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Privacy">
        {prefs.data && (
          <>
            <Row label="Profile visibility">
              <select
                value={prefs.data.profileVisibility}
                onChange={(e) =>
                  update.mutate({
                    profileVisibility: e.target.value as Preferences["profileVisibility"],
                  })
                }
                className="rounded-md px-3 py-1.5 text-sm focus:outline-none"
                style={{
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <option value="public">Public</option>
                <option value="followers">Followers only</option>
                <option value="private">Private</option>
              </select>
            </Row>
            <Toggle
              label="Twin matching"
              on={prefs.data.twinMatchingEnabled}
              onChange={(on) => update.mutate({ twinMatchingEnabled: on })}
              hint="Lets others see how closely your taste matches theirs."
            />
          </>
        )}
      </Section>

      <Section title="Appearance">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Dark only — this app is built for cinema, not spreadsheets.
        </p>
        <div className="mt-3">
          <p
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: "var(--text-faint)" }}
          >
            Pill colour grammar
          </p>
          <ColorChipLegend />
        </div>
      </Section>

      <Section title="About">
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          SlateClub · Find your next film. Find your people.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl p-5 mb-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <h2
        className="display text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-faint)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 border-b last:border-b-0"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  hint?: string;
}) {
  return (
    <div
      className="flex items-center justify-between py-2 border-b last:border-b-0"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <div>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: "var(--text-faint)" }}>
            {hint}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!on)}
        className="relative w-10 h-6 rounded-full transition-colors"
        style={{
          background: on ? "var(--cta-primary)" : "var(--bg-elevated)",
        }}
        aria-pressed={on}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
          style={{
            left: on ? "calc(100% - 22px)" : "2px",
            background: "var(--text-primary)",
          }}
        />
      </button>
    </div>
  );
}
