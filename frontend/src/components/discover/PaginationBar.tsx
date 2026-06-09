"use client";

interface Props {
  /** 0-based index of the active page. */
  page: number;
  /** Total number of fetched pages. */
  total: number;
  /** Navigate to a page (0-based). Pure state switch — never refetches. */
  onSelect: (index: number) => void;
}

/*
  PaginationBar — prev / numbered / next navigation for the already-fetched
  essence pages. Switching pages is a state-only operation (cache served);
  new pages come from the "Show more" button, not from here, so the next
  arrow is disabled on the last page.
*/
export default function PaginationBar({ page, total, onSelect }: Props) {
  if (total <= 1) return null;

  const atStart = page <= 0;
  const atEnd = page >= total - 1;

  return (
    <nav
      className="mt-6 flex items-center justify-center gap-2"
      aria-label="Recommendation pages"
    >
      <Arrow
        dir="prev"
        disabled={atStart}
        onClick={() => onSelect(page - 1)}
      />

      {Array.from({ length: total }).map((_, i) => {
        const active = i === page;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={active ? "page" : undefined}
            className="grid h-11 min-w-[44px] place-items-center rounded-full px-3 text-sm font-semibold transition-opacity cursor-pointer hover:opacity-90"
            style={{
              background: active ? "var(--cta-gradient)" : "var(--bg-elevated)",
              color: active ? "var(--bg-screening)" : "var(--text-primary)",
              border: active
                ? "1px solid transparent"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow: active
                ? "0 10px 24px -12px rgba(255, 138, 0, 0.55)"
                : "none",
            }}
          >
            {i + 1}
          </button>
        );
      })}

      <Arrow dir="next" disabled={atEnd} onClick={() => onSelect(page + 1)} />
    </nav>
  );
}

function Arrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
      className="grid h-11 w-11 place-items-center rounded-full transition-opacity cursor-pointer hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
      style={{
        background: "var(--bg-elevated)",
        color: "var(--text-primary)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: dir === "next" ? "rotate(180deg)" : undefined }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
