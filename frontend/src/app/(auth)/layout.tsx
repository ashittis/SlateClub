import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

/**
 * Auth shell. The old version was a WebGL shader flare over black; on paper the
 * equivalent move is restraint — a centred column, a ruled card, and nothing
 * else competing with the form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center px-5 py-10"
      style={{ background: "var(--void)" }}
    >
      <div className="w-full max-w-sm">
        <Link href="/login" aria-label="Kaset" style={{ color: "var(--chalk)" }}>
          <Wordmark size={26} />
        </Link>

        <p className="meta mt-3">
          Log the films you watch. Discover what&apos;s next.
        </p>

        <div
          className="mt-6 border p-5"
          style={{ borderColor: "var(--edge)", background: "var(--soot)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
