"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import MovieSearchBar from "@/components/feed/MovieSearchBar";
import Avatar from "@/components/ui/Avatar";

/*
  TopNav — desktop top bar. Primary nav + logo now live in the LeftRail;
  this bar keeps the persistent search input and the right cluster
  (Messages · Notifications · Avatar dropdown). Offset from the left by the
  rail width. Hidden below lg; on mobile the bottom tab bar takes over.
*/
export default function TopNav() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const unread = useQuery<{ count: number }>({
    queryKey: ["notifications-unread"],
    queryFn: () => apiFetch("/api/notifications/unread-count"),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const dmUnread = useQuery<{ count: number }>({
    queryKey: ["dms-unread"],
    queryFn: () => apiFetch("/api/dms/unread-count"),
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15_000,
  });

  // Close avatar dropdown on outside click.
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

  return (
    <header
      className="hidden lg:flex fixed top-0 inset-x-0 lg:left-60 h-14 z-30 items-center px-6 gap-6 backdrop-blur-md"
      style={{
        background: "rgba(10,10,11,0.78)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Search — grows to fill; primary nav lives in the LeftRail now. */}
      <div className="flex-1 max-w-xl">
        <MovieSearchBar compact placeholder="Films, people, slates…" />
      </div>

      {/* Messages (DMs) */}
      <Link
        href="/messages"
        className="relative p-2 rounded-full"
        style={{ color: "var(--text-muted)" }}
        aria-label="Messages"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
          <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
        </svg>
        {dmUnread.data && dmUnread.data.count > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: "var(--nav-active)", color: "var(--bg-screening)" }}
          >
            {dmUnread.data.count > 99 ? "99+" : dmUnread.data.count}
          </span>
        )}
      </Link>

      {/* Bell */}
      <Link
        href="/notifications"
        className="relative p-2 rounded-full"
        style={{ color: "var(--text-muted)" }}
        aria-label="Notifications"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
          <path d="M12 2.25a6.75 6.75 0 00-6.75 6.75v.75a8.22 8.22 0 01-2.12 5.52.75.75 0 00.3 1.21c1.54.56 3.16.99 4.83 1.24a3.75 3.75 0 007.48 0c1.67-.25 3.29-.68 4.83-1.24a.75.75 0 00.3-1.21 8.22 8.22 0 01-2.12-5.52V9A6.75 6.75 0 0012 2.25z" />
        </svg>
        {unread.data && unread.data.count > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{
              background: "var(--nav-active)",
              color: "var(--bg-screening)",
            }}
          >
            {unread.data.count > 99 ? "99+" : unread.data.count}
          </span>
        )}
      </Link>

      {/* Avatar */}
      {user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex rounded-full"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <Avatar name={user.name} avatarUrl={user.avatar_url} size="md" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
                }}
              >
                <div
                  className="px-3 pt-3 pb-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {user.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: "var(--text-faint)" }}
                  >
                    @{user.username}
                  </p>
                </div>
                <MenuLink
                  href={`/profile/${user.username}`}
                  onClick={() => setMenuOpen(false)}
                >
                  View profile
                </MenuLink>
                <MenuLink
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                >
                  My library
                </MenuLink>
                <MenuLink
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </MenuLink>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                  style={{ color: "var(--signal-error)" }}
                >
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>
  );
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2 text-sm hover:opacity-90"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </Link>
  );
}
