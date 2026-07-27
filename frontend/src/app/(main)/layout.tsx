"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import TopNav from "@/components/layout/TopNav";
import LeftRail from "@/components/layout/LeftRail";
import ContinueWatchingBar from "@/components/layout/ContinueWatchingBar";
import CreateMenu from "@/components/layout/CreateMenu";
import { MOBILE_NAV_ITEMS } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/navIcons";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Desktop left rail (nav + library) and top bar (search + right cluster). */}
      <LeftRail />
      <TopNav />

      {/* Page content — offset from the rail + top bar on desktop; on mobile
          padded to clear the bottom tab bar (extra clearance for the Continue
          Watching bar is applied via [data-cw-active] in globals.css). */}
      <main className="flex-1 pb-20 lg:pl-60 lg:pt-14">{children}</main>

      {/* Persistent Continue Watching bar (collapses when nothing in progress). */}
      <ContinueWatchingBar />

      {/* Mobile create FAB (bottom-right, above the tab bar). */}
      <div className="fixed bottom-20 right-4 z-40 lg:hidden">
        <CreateMenu variant="fab" />
      </div>

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
                {NAV_ICONS[item.href] ?? null}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
