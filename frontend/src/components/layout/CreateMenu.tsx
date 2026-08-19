"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { useLogStore } from "@/stores/logStore";
import { useMenu } from "./useMenu";
import { CreateIcon, LibraryIcon } from "./navIcons";

/**
 * Create — the fourth primary destination, rendered as a button rather than a
 * nav link.
 *
 * The other three items are places you go; this one is a thing you start. A
 * link that only ever leads to a menu-of-three is a wasted page load, so the
 * menu is here and /create remains the mobile destination and the fallback.
 *
 * "Log a film" leads because logging is the loop. The other two are genuinely
 * rarer, and the ordering should say so.
 */
export default function CreateMenu() {
  const { open, ref, close, toggle } = useMenu();
  const openLog = useLogStore((s) => s.openLog);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="primary"
        size="sm"
        shape="pill"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="gap-1.5 px-3.5"
      >
        <PlusIcon />
        <span className="hidden sm:inline">Create</span>
        <span className="sr-only sm:hidden">Create</span>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-56 border py-1"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              openLog();
            }}
            className="row-hover flex w-full min-h-[44px] items-center gap-3 px-3 text-left text-sm"
            style={{ color: "var(--chalk)" }}
          >
            <span style={{ color: "var(--blood-ink)" }}>
              <RecIcon />
            </span>
            <span>
              <span className="block font-medium">Log a film</span>
              <span className="meta">Record a viewing</span>
            </span>
          </button>

          <div className="my-1 border-t" style={{ borderColor: "var(--edge)" }} />

          <MenuLink href="/create/watchlist" onClick={close} icon={<LibraryIcon />}>
            New watchlist
          </MenuLink>
          <MenuLink href="/create/blend" onClick={close} icon={<CreateIcon />}>
            New blend
          </MenuLink>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="row-hover flex min-h-[44px] items-center gap-3 px-3 text-sm font-medium"
      style={{ color: "var(--chalk)" }}
    >
      <span style={{ color: "var(--xerox)" }}>{icon}</span>
      {children}
    </Link>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

/** The record dot — logging is a capture, not a form submission. */
function RecIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="10" r="4.5" fill="currentColor" />
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />
    </svg>
  );
}
