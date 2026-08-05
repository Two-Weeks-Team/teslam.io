import type { Metadata, Viewport } from "next";
import { fontVars } from "@/lib/fonts";
import { alternatesFor, getContent } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import "../globals.css";

const t = getContent("en");

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: t.meta.title,
  description: t.meta.description,
  alternates: alternatesFor("en"),
  openGraph: {
    type: "website",
    siteName: "teslam.io",
    locale: "en_US",
    url: `${SITE}/en`,
    title: t.meta.title,
    description: t.meta.description,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08090a",
  colorScheme: "dark",
};

export default function EnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
