"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Pill from "@/components/ui/Pill";

export const LANGUAGE_OPTIONS: { key: string; label: string }[] = [
  { key: "en", label: "English" },
  { key: "hi", label: "Hindi" },
  { key: "ta", label: "Tamil" },
  { key: "te", label: "Telugu" },
  { key: "ml", label: "Malayalam" },
  { key: "kn", label: "Kannada" },
  { key: "ko", label: "Korean" },
  { key: "ja", label: "Japanese" },
  { key: "fr", label: "French" },
  { key: "es", label: "Spanish" },
  { key: "it", label: "Italian" },
  { key: "de", label: "German" },
  { key: "zh", label: "Mandarin" },
];

export function languageLabel(codes: string[]): string {
  const names = codes
    .map((c) => LANGUAGE_OPTIONS.find((o) => o.key === c)?.label)
    .filter(Boolean);
  return names.join(" + ");
}

interface Props {
  open: boolean;
  initial: string[];
  /** Language codes present in the current results — only these are offered.
   *  When empty/undefined, the full list is shown. */
  available?: string[];
  onClose: () => void;
  onApply: (codes: string[]) => void;
}

/*
  MovieFilterModal — the "Fetch" pop-up. A language section (multi-select);
  applying re-runs the essence engine restricted to those languages. Built on
  the shared Modal (centred overlay). Structured to grow more sections later.
*/
export default function MovieFilterModal({
  open,
  initial,
  available,
  onClose,
  onApply,
}: Props) {
  const [selected, setSelected] = useState<string[]>(initial);

  // Re-seed local selection each time the modal opens.
  useEffect(() => {
    if (open) setSelected(initial);
  }, [open, initial]);

  const options =
    available && available.length
      ? LANGUAGE_OPTIONS.filter((o) => available.includes(o.key))
      : LANGUAGE_OPTIONS;

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Filter recommendations">
      <div>
        <p
          className="text-xs uppercase tracking-[0.2em] mb-3"
          style={{ color: "var(--text-faint)" }}
        >
          Language
        </p>
        <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
          Show essence matches only in these languages.
        </p>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <Pill
              key={opt.key}
              kind="language"
              size="md"
              active={selected.includes(opt.key)}
              onClick={() => toggle(opt.key)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSelected([])}
          className="text-sm"
          style={{ color: "var(--text-faint)" }}
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => onApply(selected)}
          className="px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{
            background: "var(--cta-gradient)",
            color: "var(--bg-screening)",
            boxShadow: "0 12px 28px -10px rgba(255, 138, 0, 0.55)",
          }}
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
