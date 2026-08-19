import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders, JetBrains_Mono, Permanent_Marker } from "next/font/google";
import Providers from "./providers";
import { Grain } from "@/components/texture";
import "./globals.css";

/*
  A server component on purpose — see providers.tsx. Keep it that way; making
  this "use client" again would drop every tag below.

  Four faces, four jobs — the split is the identity:
    display   Big Shoulders   oversized condensed caps, allowed to crop
    UI        Archivo         readable at 13-15px over texture
    metadata  JetBrains Mono  reads as camcorder timecode
    marker    Permanent Marker  handwritten annotations, used sparingly

  Grain mounts here so the whole app shares ONE noise layer rather than one
  per component.
*/
const grotesk = Archivo({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Big_Shoulders({
  variable: "--font-shoulders",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
  // Next has no metric overrides for this family, so name the fallback
  // explicitly — otherwise the swap shifts layout on first paint.
  fallback: ["Arial Narrow", "Helvetica Neue", "system-ui", "sans-serif"],
  adjustFontFallback: false,
});

// Annotations only. Loaded at one weight because it should never be a system.
const marker = Permanent_Marker({
  variable: "--font-marker-stack",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  fallback: ["Comic Sans MS", "cursive"],
  adjustFontFallback: false,
});

const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const DESCRIPTION =
  "Log the films you watch. Discover what's next. See what your friends watch. Build your cinematic identity.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Kaset — your film diary",
    template: "%s · Kaset",
  },
  description: DESCRIPTION,
  applicationName: "Kaset",
  openGraph: {
    title: "Kaset — your film diary",
    description: DESCRIPTION,
    siteName: "Kaset",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaset — your film diary",
    description: DESCRIPTION,
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  // Mirrors --void in globals.css.
  themeColor: "#14121A",
  width: "device-width",
  initialScale: 1,
  // Dense information UI — but never trap pinch-zoom.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${grotesk.variable} ${display.variable} ${marker.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Grain />
      </body>
    </html>
  );
}
