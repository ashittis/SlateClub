"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { NAV_ITEMS } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/navIcons";
import CreateMenu from "@/components/layout/CreateMenu";
import Logo from "@/components/brand/Logo";
import type { SlateCard } from "@/types/slates";

/*
  LeftRail — Spotify-style desktop rail (hidden below lg; mobile uses the
  bottom-tab bar). Logo · + Create · primary nav · divider · library
  shortcuts (your Slates + Circles). The top bar keeps the live search input
  and the messages/bell/avatar cluster.
*/

interface Circle {
  id: string;
  name: string;
}

export default function LeftRail() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const slates = useQuery<{ items: SlateCard[] }>({
    queryKey: ["slates", "mine"],
    queryFn: () => apiFetch("/api/slates/mine"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const circles = useQuery<{ items: Circle[] }>({
    queryKey: ["circles-mine"],
    queryFn: () => apiFetch("/api/circles/mine"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const slateItems = slates.data?.items ?? [];
  const circleItems = circles.data?.items ?? [];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col lg:flex"
      style={{
        background: "var(--bg-screening)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo */}
      <div className="px-5 pt-4 pb-2">
        <Link href="/home" aria-label="SlateClub home" style={{ color: "var(--text-primary)" }}>
          <Logo size={40} />
        </Link>
      </div>

      {/* Create */}
      <div className="px-3 pb-2">
        <CreateMenu variant="rail" />
      </div>

      {/* Primary nav */}
      <nav className="mt-2 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: active ? "var(--cta-primary)" : "var(--text-muted)",
                background: active ? "rgba(255,138,0,0.10)" : "transparent",
              }}
            >
              {NAV_ICONS[item.href] ?? null}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 my-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }} />

      {/* Library shortcuts */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-6">
        <p
          className="px-2 pb-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Your Library
        </p>

        {slateItems.length === 0 && circleItems.length === 0 && (
          <p className="px-2 text-xs" style={{ color: "var(--text-faint)" }}>
            Slates and circles you create show up here.
          </p>
        )}

        {slateItems.slice(0, 12).map((s) => (
          <LibraryRow key={s.id} href={`/slates/${s.id}`} label={s.title}>
            {NAV_ICONS["/slates"]}
          </LibraryRow>
        ))}

        {circleItems.slice(0, 12).map((c) => (
          <LibraryRow key={c.id} href={`/circles/${c.id}`} label={c.name}>
            {NAV_ICONS["/community"]}
          </LibraryRow>
        ))}
      </div>
    </aside>
  );
}

function LibraryRow({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
      style={{ color: "var(--text-muted)" }}
      title={label}
    >
      <span className="shrink-0 opacity-70 [&_svg]:h-4 [&_svg]:w-4">{children}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
