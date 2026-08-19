import Link from "next/link";

/**
 * A Library tab with nothing in it yet.
 *
 * Always points at the action that fills it. An empty diary is the most common
 * first screen in the app, so it has to say what to do next rather than just
 * report absence.
 */
export default function EmptyState({
  title,
  hint,
  cta = { label: "Find a film", href: "/search" },
}: {
  title: string;
  hint: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div
      className="mt-6 border border-dashed px-4 py-12 text-center"
      style={{ borderColor: "var(--edge)" }}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="meta mt-1">{hint}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex min-h-[44px] items-center border px-4 text-sm font-semibold"
        style={{
          borderColor: "var(--blood)",
          background: "var(--blood)",
          color: "var(--chalk)",
        }}
      >
        {cta.label}
      </Link>
    </div>
  );
}
