"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { SECONDARY } from "@/lib/nav";
import Avatar from "@/components/ui/Avatar";
import { useMenu } from "./useMenu";

/**
 * The avatar and everything reached through it.
 *
 * The Passport is deliberately not in primary navigation (KASET.md §7) — your
 * own profile is somewhere you visit, not somewhere you live. The avatar is its
 * only door, so this menu also has to carry Activity, Settings and sign-out.
 */
export default function AccountMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { open, ref, close, toggle } = useMenu();

  const handleSignOut = async () => {
    await logout();
    close();
    router.replace("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="flex h-11 w-11 items-center justify-center"
      >
        <Avatar avatarUrl={user?.avatar_url} name={user?.name ?? "?"} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-52 border py-1"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          {user && (
            <div className="border-b px-3 pb-2 pt-1.5" style={{ borderColor: "var(--edge)" }}>
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="meta truncate">@{user.username}</p>
            </div>
          )}

          <MenuLink href={SECONDARY.profile} onClick={close}>
            Your Passport
          </MenuLink>
          <MenuLink href={SECONDARY.activity} onClick={close}>
            Activity
          </MenuLink>
          <MenuLink href={SECONDARY.settings} onClick={close}>
            Settings
          </MenuLink>

          <div className="my-1 border-t" style={{ borderColor: "var(--edge)" }} />

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="row-hover flex min-h-[44px] w-full items-center px-3 text-left text-sm"
            style={{ color: "var(--blood-ink)" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
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
      className="row-hover flex min-h-[44px] items-center px-3 text-sm"
      style={{ color: "var(--chalk)" }}
    >
      {children}
    </Link>
  );
}
