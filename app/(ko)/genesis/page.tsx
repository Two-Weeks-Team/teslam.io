import type { Metadata } from "next";
import { GenesisPage } from "@/components/pages/genesis";
import { getGenesis } from "@/lib/i18n";
import { SITE } from "@/lib/site";

const t = getGenesis("ko");

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: {
    canonical: `${SITE}/genesis`,
    languages: { ko: `${SITE}/genesis`, en: `${SITE}/en/genesis`, "x-default": `${SITE}/genesis` },
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <GenesisPage locale="ko" />;
}
