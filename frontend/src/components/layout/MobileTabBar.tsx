"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/navIcons";

/**
 * Mobile bottom bar — all four primary items, from `lib/nav.ts`.
 *
 * Desktop splits the four (three inline in the top bar, Create as a button);
 * mobile keeps them together, because down here the bottom bar *is* the
 * navigation and a hidden fourth item would simply be lost.
 *
 * Active state is a colour lift plus a 2px rule along the top edge of the tab —
 * the same "underline the live item" signal the top bar uses. It replaced a
 * full-height inverted block, which at this size read as a pressed button
 * rather than a location.
 *
 * Tabs clear 58px and the bar respects the home-indicator inset.
 */
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t lg:hidden"
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
                color: active ? "var(--chalk)" : "var(--xerox)",
                boxShadow: active ? "inset 0 2px 0 var(--blood)" : undefined,
              }}
            >
              {Icon ? <Icon /> : null}
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ letterSpacing: "0.01em" }}
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
