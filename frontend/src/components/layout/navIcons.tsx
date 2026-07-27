import type { ReactNode } from "react";

/*
  Single source of truth for primary-nav icons, keyed by href.
  Used by the desktop LeftRail and the mobile bottom-tab bar so both
  surfaces stay visually in sync.
*/

const c = "h-5 w-5";

export const NAV_ICONS: Record<string, ReactNode> = {
  "/home": (
    <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.16-.16V20a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V20A1.5 1.5 0 018 21.5H5A1.5 1.5 0 013.5 20v-6.57l-.16.16a.75.75 0 11-1.06-1.06l8.69-8.69z" />
    </svg>
  ),
  "/search": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={c}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
    </svg>
  ),
  "/slates": (
    <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
      <path
        fillRule="evenodd"
        d="M2.25 4.125A2.625 2.625 0 014.875 1.5h6.75a2.625 2.625 0 012.625 2.625v6.75A2.625 2.625 0 0111.625 13.5h-6.75A2.625 2.625 0 012.25 10.875v-6.75zm12 0A2.625 2.625 0 0116.875 1.5h2.25A2.625 2.625 0 0121.75 4.125v2.25A2.625 2.625 0 0119.125 9h-2.25A2.625 2.625 0 0114.25 6.375v-2.25zm0 8.25A2.625 2.625 0 0116.875 9.75h2.25a2.625 2.625 0 012.625 2.625v6.75a2.625 2.625 0 01-2.625 2.625h-2.25a2.625 2.625 0 01-2.625-2.625v-6.75zM2.25 16.875a2.625 2.625 0 012.625-2.625h6.75a2.625 2.625 0 012.625 2.625v3a2.625 2.625 0 01-2.625 2.625h-6.75a2.625 2.625 0 01-2.625-2.625v-3z"
        clipRule="evenodd"
      />
    </svg>
  ),
  "/match-cut": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={c}>
      <circle cx="9" cy="12" r="6.25" />
      <circle cx="15" cy="12" r="6.25" />
    </svg>
  ),
  "/community": (
    <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
      <path d="M12 2.25a6.75 6.75 0 00-6.75 6.75v.75a8.22 8.22 0 01-2.12 5.52.75.75 0 00.3 1.21c1.54.56 3.16.99 4.83 1.24a3.75 3.75 0 007.48 0c1.67-.25 3.29-.68 4.83-1.24a.75.75 0 00.3-1.21 8.22 8.22 0 01-2.12-5.52V9A6.75 6.75 0 0012 2.25z" />
    </svg>
  ),
  "/releases": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={c}>
      <rect x="3.25" y="4.75" width="17.5" height="16" rx="2" />
      <path strokeLinecap="round" d="M3.5 9.25h17M8 2.75v3.5M16 2.75v3.5" />
    </svg>
  ),
  "/profile": (
    <svg viewBox="0 0 24 24" fill="currentColor" className={c}>
      <path
        fillRule="evenodd"
        d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
        clipRule="evenodd"
      />
    </svg>
  ),
};
