import type { Metadata } from "next";
import { ModelPage } from "@/components/pages/model";
import { getModel, modelAlternatesFor } from "@/lib/i18n";

const t = getModel("ko");

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: modelAlternatesFor("ko"),
};

export default function Page() {
  return <ModelPage locale="ko" />;
}
