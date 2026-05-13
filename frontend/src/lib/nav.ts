import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  href: string;
}

/*
  Single source of truth for primary nav. Used by both the desktop
  TopNav and the mobile bottom-tab bar.
*/
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home" },
  { label: "Discover", href: "/discover" },
  { label: "Slates", href: "/slates" },
  { label: "Community", href: "/community" },
  { label: "Releases", href: "/releases" },
];

/*
  Mobile-only condensed nav (5 slots). Same items, but Releases is
  swapped for Profile so the user can always reach their account.
*/
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home" },
  { label: "Discover", href: "/discover" },
  { label: "Slates", href: "/slates" },
  { label: "Community", href: "/community" },
  { label: "Profile", href: "/profile" },
];

export type NavIconRenderer = (item: NavItem) => ReactNode;
