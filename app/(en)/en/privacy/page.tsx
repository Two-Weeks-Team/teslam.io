import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal";
import { getLegal, legalAlternatesFor } from "@/lib/i18n";

const t = getLegal("en").privacy;

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: legalAlternatesFor("en", "privacy"),
};

export default function Page() {
  return <LegalPage locale="en" slug="privacy" />;
}
