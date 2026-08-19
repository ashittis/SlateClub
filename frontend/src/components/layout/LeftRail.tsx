"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SECONDARY, isNavActive } from "@/lib/nav";
import { NAV_ICONS } from "@/components/layout/navIcons";
import { Wordmark } from "@/components/brand/Logo";

/**
 * Desktop navigation rail. Hidden below `lg` — mobile gets MobileTabBar, which
 * renders the same four items from the same source.
 *
 * The active item inverts to a solid bleach block: on a black canvas a filled
 * shape is the clearest possible marker, and it reads as a strip of tape stuck
 * over the label. Everything else stays quiet so the inversion carries.
 */
export default function LeftRail() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r-2 lg:flex"
      style={{ borderColor: "var(--edge)", background: "var(--void)" }}
    >
      <div
        className="flex h-16 items-center border-b-2 px-4"
        style={{ borderColor: "var(--edge)" }}
      >
        <Link href="/home" aria-label="Kaset home" style={{ color: "var(--chalk)" }}>
          <Wordmark size={20} />
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 p-2" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = NAV_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[44px] items-center gap-3 px-3 text-sm font-semibold uppercase tracking-wide transition-colors"
              style={{
                background: active ? "var(--bleach)" : "transparent",
                color: active ? "var(--void)" : "var(--xerox)",
              }}
            >
              {Icon ? <Icon /> : null}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t-2 p-4" style={{ borderColor: "var(--edge)" }}>
        <Link
          href={SECONDARY.settings}
          className="section-label transition-colors hover:text-[var(--acid)]"
        >
          Settings
        </Link>
      </div>
    </aside>
  );
}
