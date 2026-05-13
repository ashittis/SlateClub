"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import MovieSearchBar from "@/components/feed/MovieSearchBar";
import { NAV_ITEMS } from "@/lib/nav";

/*
  TopNav — desktop horizontal nav (Letterboxd / Apple style).
  Hidden below lg; on mobile the existing bottom tab bar takes over.

  Layout:
    Logo · NAV_ITEMS · Search input · Bell (with unread badge) · Avatar dropdown
*/
export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const unread = useQuery<{ count: number }>({
    queryKey: ["notifications-unread"],
    queryFn: () => apiFetch("/api/notifications/unread-count"),
    enabled: !!user,
    refetchInterval: 30_000,
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
      className="hidden lg:flex fixed top-0 inset-x-0 h-14 z-40 items-center px-6 gap-6 backdrop-blur-md"
      style={{
        background: "rgba(10,10,11,0.78)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Logo */}
      <Link
        href="/home"
        className="display text-lg font-bold tracking-tight shrink-0"
        style={{ color: "var(--text-primary)" }}
      >
        Slate
        <span style={{ color: "var(--cta-primary)" }}>Club</span>
      </Link>

      {/* Nav items */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                color: active ? "var(--nav-active)" : "var(--text-muted)",
                background: active ? "rgba(196,113,110,0.12)" : "transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Search — flex-1 so it grows to fill */}
      <div className="flex-1 max-w-md ml-auto">
        <MovieSearchBar compact placeholder="Films, people…" />
      </div>

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
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: "var(--cta-primary)",
              color: "var(--bg-screening)",
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {user.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              user.name[0]?.toUpperCase()
            )}
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
