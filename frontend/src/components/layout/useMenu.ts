"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dropdown plumbing for the top bar's two menus.
 *
 * Both the account menu and the Create menu need the same three things:
 * close on outside click, close on Escape, and a ref to anchor the panel. That
 * was written twice; this is it written once.
 *
 * Deliberately not a focus trap — these are menus, not dialogs. Tabbing out of
 * one should move on through the bar, not be caught.
 */
export function useMenu<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    // `mousedown` rather than `click`, so the menu closes before a click lands
    // on whatever is underneath it. Touch is listed separately because iOS does
    // not fire mousedown until after the tap resolves.
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref, close: () => setOpen(false), toggle: () => setOpen((o) => !o) };
}
