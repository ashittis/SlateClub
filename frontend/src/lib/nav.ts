import type { ReactNode } from "react";

export interface NavItem {
  label: string;
  href: string;
}

/*
  Single source of truth for primary nav. Used by the desktop LeftRail
  and the mobile bottom-tab bar.
*/
// Discover was absorbed into Home (the essence answer + theatres/OTT + hidden
// gems all live there now), so it's no longer a destination. Search is a rail
// destination on desktop (the top bar keeps the live search input too).
export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home" },
  { label: "Search", href: "/search" },
  { label: "Slates", href: "/slates" },
  { label: "Match Cut", href: "/match-cut" },
  { label: "Community", href: "/community" },
  { label: "Releases", href: "/releases" },
];

/*
  Mobile-only condensed nav (5 slots). The freed Discover slot goes to Search —
  "I know what I want" deserves a door that isn't a poster wall. (Desktop keeps
  its search bar in the top nav.)
*/
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home" },
  { label: "Search", href: "/search" },
  { label: "Slates", href: "/slates" },
  { label: "Community", href: "/community" },
  { label: "Profile", href: "/profile" },
];

export type NavIconRenderer = (item: NavItem) => ReactNode;
