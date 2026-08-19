const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * The single HTTP client. On a 401 it refreshes the session cookie once and
 * retries; a second failure propagates.
 *
 * Do not call this directly from a component — go through a domain module in
 * this folder. Endpoint strings inlined into components are how a route rename
 * turns into a repo-wide grep with no compiler help.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () =>
    fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });

  let res = await send();

  if (res.status === 401 && !path.includes("/auth/refresh")) {
    const refreshed = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshed.ok) res = await send();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = (body as { detail?: unknown; error?: unknown } | null)?.detail
      ?? (body as { error?: unknown } | null)?.error;
    throw new Error(
      typeof detail === "string" ? detail : `API error: ${res.status}`,
    );
  }

  // 204 and other empty bodies would blow up .json().
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => apiFetch<T>(path);

export const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const patch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const del = <T>(path: string) => apiFetch<T>(path, { method: "DELETE" });

/** TMDB image URL, or the local placeholder when a film has no poster. */
export function tmdbImage(
  path: string | null | undefined,
  size: "w200" | "w300" | "w500" | "w780" | "original" = "w500",
): string {
  if (!path) return "/placeholder-poster.svg";
  const base = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";
  return `${base}/${size}${path}`;
}
