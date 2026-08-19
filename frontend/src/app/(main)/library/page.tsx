import type { Metadata } from "next";
import LibraryTabs from "@/components/library/LibraryTabs";
import Page from "@/components/layout/Page";

export const metadata: Metadata = { title: "Your Library" };

/**
 * Your Library — the user's personal cinema record (KASET.md §8).
 *
 * The tab frame and routing land here in Phase 1 so the nav destination is
 * real; Phase 4 fills each tab with the diary, ratings, reviews and watchlist
 * once the logging system underneath them exists.
 */
export default function LibraryPage() {
  return (
    <Page>
      <h1 className="text-2xl">Your Library</h1>
      <p className="meta mt-1">Everything you&apos;ve watched, rated, and saved</p>
      <LibraryTabs />
    </Page>
  );
}
