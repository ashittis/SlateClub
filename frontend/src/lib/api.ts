const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (res.status === 401 && !path.includes("/auth/refresh")) {
    // Try to refresh token
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      // Retry original request
      const retryRes = await fetch(`${API_URL}${path}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });
      if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
      return retryRes.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    const message =
      (error as any)?.detail ||
      (error as any)?.error ||
      `API error: ${res.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return res.json() as Promise<T>;
}

// Image URL helper
export function tmdbImage(path: string | null, size: "w200" | "w300" | "w500" | "w780" | "original" = "w500"): string {
  if (!path) return "/placeholder-poster.svg";
  const base = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE || "https://image.tmdb.org/t/p";
  return `${base}/${size}${path}`;
}
