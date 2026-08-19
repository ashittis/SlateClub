import type { ReactNode } from "react";
import { duotoneFor, duotoneStyle, type Duotone as DuotoneSpec } from "@/lib/genre-duotone";

/**
 * Duotone wash for editorial imagery.
 *
 * Wraps an image and washes it in the film's genre colour (KASET design system).
 * Pure CSS — greyscale filter plus two blended overlays — so there's no image
 * processing, no canvas, and no per-image request.
 *
 * Use this for imagery that carries mood: film backdrops, share cards, match
 * reveals, empty states. **Not** for poster thumbnails in grids and lists —
 * washing those makes films unrecognisable, and posters are the content.
 *
 * Falls back to plain greyscale where `mix-blend-mode` is unsupported; see the
 * `@supports` guard in globals.css.
 */
export default function Duotone({
  genres,
  duotone,
  className = "",
  halftone = false,
  children,
}: {
  /** Film genres — the duotone is picked from the first recognised one. */
  genres?: string[] | null;
  /** Override the genre lookup with an explicit pairing. */
  duotone?: DuotoneSpec;
  className?: string;
  /** Overlay a newspaper dot screen on top of the wash. */
  halftone?: boolean;
  children: ReactNode;
}) {
  const spec = duotone ?? duotoneFor(genres);
  return (
    <div
      className={`duotone ${className}`}
      style={duotoneStyle(spec)}
      data-halftone={halftone || undefined}
    >
      {children}
      {halftone && (
        <span
          aria-hidden
          className="halftone pointer-events-none absolute inset-0 z-[2] opacity-45"
        />
      )}
    </div>
  );
}
