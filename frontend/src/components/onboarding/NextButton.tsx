"use client";

/**
 * The step's primary action, plus an optional Skip.
 *
 * Skip is a real, visible control — not a small grey link. Only the first step
 * is required, and hiding that fact would make onboarding feel longer than it is.
 */
export default function NextButton({
  onClick,
  onSkip,
  disabled = false,
  pending = false,
  label = "Continue",
  skipLabel = "Skip",
}: {
  onClick: () => void;
  onSkip?: () => void;
  disabled?: boolean;
  pending?: boolean;
  label?: string;
  skipLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="min-h-[48px] border px-4 text-sm font-medium"
          style={{ borderColor: "var(--edge)", color: "var(--xerox)" }}
        >
          {skipLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className="min-h-[48px] flex-1 border px-4 text-sm font-semibold transition-opacity disabled:opacity-40"
        style={{
          borderColor: "var(--blood)",
          background: "var(--blood)",
          color: "var(--chalk)",
        }}
      >
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}
