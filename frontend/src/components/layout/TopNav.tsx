"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { notificationsApi } from "@/lib/api/notifications";
import { messagesApi } from "@/lib/api/messages";
import { SECONDARY } from "@/lib/nav";
import { BellIcon, MessagesIcon } from "@/components/layout/navIcons";
import { Wordmark } from "@/components/brand/Logo";
import Avatar from "@/components/ui/Avatar";

/**
 * The top bar carries the secondary destinations that must be reachable from
 * anywhere but are not primary navigation: Messages, Notifications, and the
 * avatar (the only route to the Passport).
 *
 * On desktop it sits to the right of the rail. On mobile it is the header —
 * the four primary items live in the bottom bar instead.
 */
export default function TopNav() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const handleSignOut = async () => {
    await logout();
    setMenuOpen(false);
    router.replace("/login");
  };

  const count = (n: number | undefined) => (n && n > 0 ? n : null);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center gap-2 border-b-2 px-3 lg:left-60 lg:px-5"
      style={{ borderColor: "var(--edge)", background: "var(--void)" }}
    >
      {/* Mobile brand — desktop shows it in the rail instead. */}
      <Link
        href="/home"
        aria-label="Kaset home"
        className="lg:hidden"
        style={{ color: "var(--chalk)" }}
      >
        <Wordmark size={20} />
      </Link>

      <div className="ml-auto flex items-center gap-1">
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

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Your account"
            className="flex h-11 w-11 items-center justify-center"
          >
            <Avatar avatarUrl={user?.avatar_url} name={user?.name ?? "?"} size="sm" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-48 border py-1"
              style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
            >
              <MenuLink href={SECONDARY.profile} onClick={() => setMenuOpen(false)}>
                Your Passport
              </MenuLink>
              <MenuLink href={SECONDARY.activity} onClick={() => setMenuOpen(false)}>
                Activity
              </MenuLink>
              <MenuLink href={SECONDARY.settings} onClick={() => setMenuOpen(false)}>
                Settings
              </MenuLink>
              <div className="my-1 border-t-2" style={{ borderColor: "var(--edge)" }} />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="block w-full px-3 py-2 text-left text-sm"
                style={{ color: "var(--blood-ink)" }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function IconLink({
  href,
  label,
  badge,
  children,
}: {
  href: string;
  label: string;
  badge: number | null;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label} (${badge} unread)` : label}
      className="relative flex h-11 w-11 items-center justify-center"
      style={{ color: "var(--xerox)" }}
    >
      {children}
      {badge ? (
        <span
          className="absolute right-1.5 top-1.5 min-w-[16px] px-1 text-center text-[10px] font-bold leading-4"
          style={{ background: "var(--acid)", color: "var(--void)" }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-3 py-2 text-sm"
      style={{ color: "var(--chalk)" }}
    >
      {children}
    </Link>
  );
}
