/*
  Primary navigation — the single source of truth for the desktop rail and the
  mobile bottom bar. Both surfaces render the SAME four items, in the same
  order, because they are the same mental model (KASET.md §7).

  Nothing else belongs here. Profile is reached through the avatar; Messages
  and Notifications live in the top bar. If you are tempted to add a fifth
  item, the feature probably belongs inside one of these four.
*/

export interface NavItem {
  label: string;
  href: string;
  /** Matches this item when the pathname starts with any of these. */
  match: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/home", match: ["/home"] },
  { label: "Search", href: "/search", match: ["/search"] },
  { label: "Your Library", href: "/library", match: ["/library"] },
  { label: "Create", href: "/create", match: ["/create"] },
];

/** Secondary destinations — reachable, but never primary nav. */
export const SECONDARY = {
  messages: "/messages",
  notifications: "/notifications",
  activity: "/activity",
  profile: "/passport",
  settings: "/settings",
} as const;

export function isNavActive(item: NavItem, pathname: string): boolean {
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
