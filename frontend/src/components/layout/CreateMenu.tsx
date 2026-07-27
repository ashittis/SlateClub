"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import CreateSlateModal from "@/components/slates/CreateSlateModal";
import AiSlateModal from "@/components/slates/AiSlateModal";
import type { SlateCard } from "@/types/slates";

/*
  CreateMenu — the global "+" create affordance (spec §8). Lives in the
  desktop LeftRail and doubles as a mobile FAB. Opens a small menu:
  Slate · Collaborative Slate · Match Cut · AI Slate (Beta) · New Post.
  Each item routes to the existing creation surface.

  `variant`:
   - "rail": full-width labelled "+ Create" button (desktop rail)
   - "fab": circular floating button (mobile)
*/

type Sheet = null | "slate" | "collab" | "ai";

interface CreateMenuProps {
  variant?: "rail" | "fab";
}

const PlusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-5 w-5">
    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
  </svg>
);

export default function CreateMenu({ variant = "rail" }: CreateMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const onSlateCreated = (slate: SlateCard) => router.push(`/slates/${slate.id}`);

  return (
    <div className="relative" ref={ref}>
      {variant === "rail" ? (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--cta-gradient)", color: "var(--bg-screening)" }}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {PlusIcon}
          Create
        </button>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg"
          style={{ background: "var(--cta-gradient)", color: "var(--bg-screening)" }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Create"
        >
          {PlusIcon}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: variant === "fab" ? 8 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: variant === "fab" ? 8 : -6 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-56 overflow-hidden rounded-xl ${
              variant === "fab" ? "bottom-16 right-0" : "left-0 top-full mt-2"
            }`}
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -16px rgba(0,0,0,0.7)",
            }}
          >
            <MenuRow label="Slate" onClick={() => go(() => setSheet("slate"))}>
              {IconList}
            </MenuRow>
            <MenuRow label="Collaborative Slate" onClick={() => go(() => setSheet("collab"))}>
              {IconPeople}
            </MenuRow>
            <MenuRow label="Match Cut" onClick={() => go(() => router.push("/match-cut"))}>
              {IconCut}
            </MenuRow>
            <MenuRow
              label="AI Slate"
              badge="Beta"
              onClick={() => go(() => setSheet("ai"))}
            >
              {IconSparkle}
            </MenuRow>
            <MenuRow label="New Post" onClick={() => go(() => router.push("/community"))}>
              {IconPlusCircle}
            </MenuRow>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slate + Collaborative Slate share one modal (it has a collaborator picker). */}
      <CreateSlateModal
        open={sheet === "slate" || sheet === "collab"}
        onClose={() => setSheet(null)}
        onCreated={onSlateCreated}
      />
      <AiSlateModal open={sheet === "ai"} onClose={() => setSheet(null)} />
    </div>
  );
}

function MenuRow({
  label,
  badge,
  onClick,
  children,
}: {
  label: string;
  badge?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
      style={{ color: "var(--text-primary)" }}
    >
      <span style={{ color: "var(--text-muted)" }}>{children}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: "rgba(255,120,0,0.16)", color: "var(--cta-primary)" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

const ic = "h-4 w-4";
const IconList = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={ic}>
    <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const IconPeople = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={ic}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path strokeLinecap="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const IconCut = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={ic}>
    <circle cx="9" cy="12" r="5.5" />
    <circle cx="15" cy="12" r="5.5" />
  </svg>
);
const IconSparkle = (
  <svg viewBox="0 0 24 24" fill="currentColor" className={ic}>
    <path d="M12 2l1.9 5.5L19.5 9l-5.6 1.5L12 16l-1.9-5.5L4.5 9l5.6-1.5L12 2z" />
  </svg>
);
const IconPlusCircle = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={ic}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 8v8M8 12h8" />
  </svg>
);
