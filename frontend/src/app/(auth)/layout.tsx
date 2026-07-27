import Link from "next/link";
import Logo from "@/components/brand/Logo";
import AmbientGlow from "@/components/ui/AmbientGlow";
import FilmGrain from "@/components/ui/FilmGrain";
import { ShaderAnimation } from "@/components/ui/shader-animation";

/*
  Cinematic auth shell — printed onto darkness. A live WebGL shader flare
  (warm-tinted) is the backdrop, with a CSS AmbientGlow fallback beneath and a
  dark scrim above it so the left-aligned content stays readable.
*/
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col" style={{ background: "#000000" }}>
      {/* Fallback base (shows if WebGL is unavailable) */}
      <AmbientGlow intensity="high" focusY={38} />
      {/* Live shader backdrop */}
      <ShaderAnimation className="absolute inset-0 h-full w-full" />
      {/* Legibility scrim — keeps headline (top) + form (bottom) readable */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 38%, rgba(0,0,0,0.8) 100%), radial-gradient(120% 80% at 50% 40%, transparent 45%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <FilmGrain opacity={0.05} />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8 sm:px-8">
        <Link
          href="/login"
          aria-label="SlateClub"
          style={{ color: "var(--text-primary)" }}
        >
          <Logo size={44} />
        </Link>

        <div className="flex flex-1 flex-col justify-end pb-2">{children}</div>
      </div>
    </div>
  );
}
