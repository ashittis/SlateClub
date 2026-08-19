import TopNav from "@/components/layout/TopNav";
import LeftRail from "@/components/layout/LeftRail";
import MobileTabBar from "@/components/layout/MobileTabBar";

/**
 * The signed-in shell.
 *
 * Desktop: rail on the left, top bar across the rest.
 * Mobile:  top bar as the header, four primary items in the bottom bar.
 *
 * Both surfaces render the same four items from `lib/nav.ts`. The content well
 * is padded to clear the fixed bars on each surface.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--void)" }}>
      <LeftRail />
      <TopNav />

      <main className="flex-1 pt-16 pb-[calc(58px+env(safe-area-inset-bottom))] lg:pl-60 lg:pb-0">
        {children}
      </main>

      <MobileTabBar />
    </div>
  );
}
