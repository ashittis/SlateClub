/**
 * The detail-page href for a film.
 *
 * Kaset is films only, so this no longer branches on media type. The optional
 * second parameter is accepted and ignored so the profile surfaces still
 * compile until Phase 5 rebuilds them; prefer `filmHref` from `lib/api/films`,
 * which also builds the readable slug.
 *
 * @deprecated Use `filmHref` from `@/lib/api/films`.
 */
export function titleHref(tmdbId: number, _legacyMediaType?: string | null): string {
  return `/film/${tmdbId}`;
}
