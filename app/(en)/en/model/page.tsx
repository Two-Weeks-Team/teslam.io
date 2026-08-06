import type { Metadata } from "next";
import { ModelPage } from "@/components/pages/model";
import { getModel, modelAlternatesFor } from "@/lib/i18n";

const t = getModel("en");

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: modelAlternatesFor("en"),
};

export default function Page() {
  return <ModelPage locale="en" />;
}
