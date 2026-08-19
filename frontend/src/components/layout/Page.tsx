import Link from "next/link";

/**
 * The content well.
 *
 * Every page under `(main)` used to open with its own hand-written
 * `mx-auto max-w-3xl px-4 pb-16 pt-6 lg:px-8` — nineteen copies of the same
 * intention, drifting apart a token at a time. This is that intention, once.
 *
 * Two widths, and the choice is about the content, not the page:
 *   default   grids, feeds, poster rows — things that want room
 *   narrow    prose and forms, where a long measure hurts reading
 */
export default function Page({
  width = "default",
  className = "",
  children,
}: {
  width?: "default" | "narrow";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "mx-auto w-full px-4 pb-20 pt-6 lg:px-6",
        width === "narrow" ? "max-w-3xl" : "max-w-[1100px]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/**
 * A page's opening block: title, optional standfirst, optional trailing action.
 * Headings are sentence case now (globals.css), so this is a plain h1 — the
 * condensed display face is reserved for hero surfaces.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-3xl">{title}</h1>
        {subtitle ? <p className="meta mt-1.5">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * A titled section with an optional "see all" link.
 *
 * Lifted out of the home page, where it was a local helper, because the film
 * page, library and search all grew their own near-identical copy.
 */
export function Section({
  title,
  href,
  linkLabel = "see all",
  className = "",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mt-8 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="section-label">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="section-label transition-colors hover:text-[var(--chalk)]"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
