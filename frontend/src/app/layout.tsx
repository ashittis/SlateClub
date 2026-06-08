"use client";

import { useEffect, useRef } from "react";
import { Inter } from "next/font/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import FilmGrain from "@/components/ui/FilmGrain";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 30, // keep inactive/in-flight queries alive across navigation
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <head>
        <title>SlateClub</title>
        <meta name="description" content="Find your next film. Find your people." />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ background: "var(--bg-screening)", color: "var(--text-primary)" }}
      >
        <QueryClientProvider client={queryClient}>
          <AuthBootstrap>{children}</AuthBootstrap>
        </QueryClientProvider>
        <FilmGrain opacity={0.03} />
      </body>
    </html>
  );
}
