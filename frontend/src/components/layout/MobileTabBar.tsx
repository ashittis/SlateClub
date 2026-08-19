"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/navIcons";

/**
 * Mobile bottom bar — the same four items as the rail, from the same source.
 *
 * Active state is a full-height bleach block, matching the rail's inversion so
 * the two surfaces teach the same signal. Tabs clear 56px and the bar respects
 * the home-indicator inset.
 */
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 lg:hidden"
      style={{
        borderColor: "var(--edge)",
        background: "var(--void)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = NAV_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1"
              style={{
                background: active ? "var(--bleach)" : "transparent",
                color: active ? "var(--void)" : "var(--xerox)",
              }}
            >
              {Icon ? <Icon /> : null}
              <span
                className="text-[10px] font-bold uppercase leading-none"
                style={{ letterSpacing: "0.06em" }}
              >
                {item.label === "Your Library" ? "Library" : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
