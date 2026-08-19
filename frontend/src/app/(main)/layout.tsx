import TopBar from "@/components/layout/TopBar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import LogDialog from "@/components/log/LogDialog";

/**
 * The signed-in shell.
 *
 * One horizontal bar on both surfaces, and on mobile a bottom bar carrying the
 * same four primary items. There is no vertical rail: the content here is
 * posters and dense rows, both of which want the full width of the window.
 *
 * `LogDialog` is mounted once, here, rather than per page. Logging can be
 * started from the top bar, a film page or a poster's quick actions, and all
 * three drive the same store (`stores/logStore.ts`) — so there is exactly one
 * log surface in the tree at any time.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--void)" }}>
      <TopBar />

      <main className="flex-1 pt-16 pb-[calc(58px+env(safe-area-inset-bottom))] lg:pb-0">
        {children}
      </main>

      <MobileTabBar />
      <LogDialog />
    </div>
  );
}
