import type { Metadata } from "next";
import { LegalPage } from "@/components/pages/legal";
import { getLegal, legalAlternatesFor } from "@/lib/i18n";

const t = getLegal("en").terms;

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: legalAlternatesFor("en", "terms"),
};

export default function Page() {
  return <LegalPage locale="en" slug="terms" />;
}
