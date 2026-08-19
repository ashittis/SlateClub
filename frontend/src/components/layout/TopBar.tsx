"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { notificationsApi } from "@/lib/api/notifications";
import { messagesApi } from "@/lib/api/messages";
import { NAV_ITEMS, SECONDARY, isNavActive } from "@/lib/nav";
import { BellIcon, MessagesIcon, SearchIcon } from "@/components/layout/navIcons";
import { Wordmark } from "@/components/brand/Logo";
import AccountMenu from "./AccountMenu";
import CreateMenu from "./CreateMenu";
import SearchField from "./SearchField";

/**
 * The top bar — the entire signed-in chrome, on every surface.
 *
 * This replaced a 240px desktop rail. The rail was spending a sixth of a laptop
 * screen on four words that never change, on a product whose content is
 * posters: things that want width. Everything the rail carried is here, and the
 * space it was holding went back to the film grid.
 *
 * Composition, left to right:
 *   wordmark · primary nav · search · messages · notifications · Create · avatar
 *
 * The primary items come from `lib/nav.ts` — still the single source of truth
 * for both surfaces. Create is filtered out of the inline set because it is
 * rendered as the button on the right: same four concepts, one of them shaped
 * like the action it is. Below `lg` the inline nav disappears entirely and
 * MobileTabBar carries all four along the bottom.
 */
export default function TopBar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: notificationsApi.unreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const dmUnread = useQuery({
    queryKey: ["messages", "unread"],
    queryFn: messagesApi.unreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const count = (n: number | undefined) => (n && n > 0 ? n : null);
  const inlineNav = NAV_ITEMS.filter((i) => i.href !== "/create");

  return (
    <header
      className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center gap-2 border-b px-3 lg:gap-4 lg:px-5"
      style={{ borderColor: "var(--edge)", background: "var(--void)" }}
    >
      <Link
        href="/home"
        aria-label="Kaset home"
        className="shrink-0"
        style={{ color: "var(--chalk)" }}
      >
        <Wordmark size={20} />
      </Link>

      <nav className="hidden shrink-0 items-center gap-0.5 lg:flex" aria-label="Primary">
        {inlineNav.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="flex h-11 items-center px-3 text-sm font-semibold transition-colors"
              style={{
                color: active ? "var(--chalk)" : "var(--xerox)",
                // A hairline under the active item rather than a filled block:
                // in a horizontal bar an inversion reads as a button, and the
                // one filled thing here should be Create.
                boxShadow: active ? "inset 0 -2px 0 var(--blood)" : undefined,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/*
        useSearchParams suspends during prerender, and an un-bounded suspend in
        a layout-level component fails the build for every route beneath it.
        The fallback is the field's own resting shape, so nothing shifts.
      */}
      <div className="mx-auto hidden w-full max-w-md sm:block">
        <Suspense fallback={<SearchFieldSkeleton />}>
          <SearchField />
        </Suspense>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
        {/* Below sm the field is gone — search is still one tap away. */}
        <IconLink href="/search" label="Search" badge={null} className="sm:hidden">
          <SearchIcon />
        </IconLink>

        <IconLink
          href={SECONDARY.messages}
          label="Messages"
          badge={count(dmUnread.data?.count)}
        >
          <MessagesIcon />
        </IconLink>
        <IconLink
          href={SECONDARY.notifications}
          label="Notifications"
          badge={count(unread.data?.count)}
        >
          <BellIcon />
        </IconLink>

        <CreateMenu />
        <AccountMenu />
      </div>
    </header>
  );
}

function SearchFieldSkeleton() {
  return (
    <div
      className="pill h-10 w-full border"
      style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
      aria-hidden
    />
  );
}

function IconLink({
  href,
  label,
  badge,
  className = "",
  children,
}: {
  href: string;
  label: string;
  badge: number | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label} (${badge} unread)` : label}
      className={`relative flex h-11 w-11 items-center justify-center transition-colors hover:text-[var(--chalk)] ${className}`}
      style={{ color: "var(--xerox)" }}
    >
      {children}
      {badge ? (
        <span
          className="pill absolute right-1 top-1.5 min-w-[16px] px-1 text-center text-[10px] font-bold leading-4"
          style={{ background: "var(--blood)", color: "var(--chalk)" }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
