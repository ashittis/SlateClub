import type { MediaType } from "@/types/movie";

/**
 * The detail-page href for any title. Series live at /series/{id}, films at
 * /film/{id}. Anything without an explicit tv media_type is treated as a film
 * (back-compat with every existing movie link).
 */
export function titleHref(
  tmdbId: number,
  mediaType?: MediaType | string | null,
): string {
  return mediaType === "tv" ? `/series/${tmdbId}` : `/film/${tmdbId}`;
}
