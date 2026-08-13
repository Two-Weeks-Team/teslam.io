import type { Metadata, Viewport } from "next";
import { fontVars } from "@/lib/fonts";
import { alternatesFor, getContent } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import "../globals.css";

/**
 * There is no `app/layout.tsx`. Each locale group is its own root layout, so
 * `<html lang>` is correct without middleware negotiating locale on every
 * request. The cost is that switching locale is a full document load, which is
 * the behaviour this site wants anyway.
 */
const t = getContent("ko");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: t.meta.title,
  description: t.meta.description,
  alternates: alternatesFor("ko"),
  openGraph: {
    type: "website",
    siteName: "teslam.io",
    locale: "ko_KR",
    url: `${SITE}/`,
    title: t.meta.title,
    description: t.meta.description,
    images: [{ url: `${SITE}/img/og.webp`, width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08090a",
  colorScheme: "dark",
};

export default function KoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
