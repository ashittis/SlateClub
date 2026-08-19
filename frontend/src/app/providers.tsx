"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";

/**
 * The client boundary. Everything stateful lives here so `app/layout.tsx` can
 * stay a server component and actually use Next's `metadata` export — the old
 * root layout was `"use client"`, which silently forfeited every OG, Twitter
 * and manifest tag in the app.
 */

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const ran = useRef(false);

  useEffect(() => {
    if (!ran.current) {
      ran.current = true;
      fetchUser();
    }
  }, [fetchUser]);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // Built once per browser session, not per render — a QueryClient created in
  // the render body would drop its cache on every re-render.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 1000 * 60 * 30,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
