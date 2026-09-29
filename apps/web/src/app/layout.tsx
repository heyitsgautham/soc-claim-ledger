import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";
import { BRAND } from "@/lib/brand";

// Every face ships with the app. The tool runs air-gapped, so nothing loads from a font CDN.
const serif = localFont({
  variable: "--font-plex-serif",
  display: "block",
  adjustFontFallback: "Times New Roman",
  src: [
    { path: "./fonts/ibm-plex-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/ibm-plex-serif-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-serif-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

const sans = localFont({
  variable: "--font-plex-sans",
  display: "block",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

const mono = localFont({
  variable: "--font-plex-mono",
  display: "block",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: BRAND.product,
  description: "What a CSE attests about its SOC, beside what its own alert and case records say.",
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex h-dvh flex-col overflow-hidden">
        <div id="scroll-root" className="min-h-0 flex-1 overflow-y-auto" data-testid="scroll-root">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
