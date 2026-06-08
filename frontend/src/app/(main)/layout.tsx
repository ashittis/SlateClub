"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TopNav from "@/components/layout/TopNav";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";

const MOBILE_ICONS: Record<string, React.ReactNode> = {
  "/home": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.16-.16V20a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V20A1.5 1.5 0 018 21.5H5A1.5 1.5 0 013.5 20v-6.57l-.16.16a.75.75 0 11-1.06-1.06l8.69-8.69z" />
    </svg>
  ),
  "/discover": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM10.5 12 14 8.5 10.5 12zm0 0L7 15.5 10.5 12z"
        clipRule="evenodd"
      />
    </svg>
  ),
  "/slates": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M2.25 4.125A2.625 2.625 0 014.875 1.5h6.75a2.625 2.625 0 012.625 2.625v6.75A2.625 2.625 0 0111.625 13.5h-6.75A2.625 2.625 0 012.25 10.875v-6.75zm12 0A2.625 2.625 0 0116.875 1.5h2.25A2.625 2.625 0 0121.75 4.125v2.25A2.625 2.625 0 0119.125 9h-2.25A2.625 2.625 0 0114.25 6.375v-2.25zm0 8.25A2.625 2.625 0 0116.875 9.75h2.25a2.625 2.625 0 012.625 2.625v6.75a2.625 2.625 0 01-2.625 2.625h-2.25a2.625 2.625 0 01-2.625-2.625v-6.75zM2.25 16.875a2.625 2.625 0 012.625-2.625h6.75a2.625 2.625 0 012.625 2.625v3a2.625 2.625 0 01-2.625 2.625h-6.75a2.625 2.625 0 01-2.625-2.625v-3z"
        clipRule="evenodd"
      />
    </svg>
  ),
  "/community": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.25a6.75 6.75 0 00-6.75 6.75v.75a8.22 8.22 0 01-2.12 5.52.75.75 0 00.3 1.21c1.54.56 3.16.99 4.83 1.24a3.75 3.75 0 007.48 0c1.67-.25 3.29-.68 4.83-1.24a.75.75 0 00.3-1.21 8.22 8.22 0 01-2.12-5.52V9A6.75 6.75 0 0012 2.25z" />
    </svg>
  ),
  "/profile": (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Desktop top nav (hidden on mobile, handled inside the component). */}
      <TopNav />

      {/* Page content — top-padded on desktop to clear the fixed top nav. */}
      <main className="flex-1 pb-20 lg:pt-14">{children}</main>

      {/* Mobile bottom tab bar. */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-lg lg:hidden"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "rgba(10,10,11,0.9)",
        }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs font-medium transition-colors"
                style={{
                  color: isActive ? "var(--cta-primary)" : "var(--text-faint)",
                }}
              >
                {MOBILE_ICONS[item.href] ?? null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
