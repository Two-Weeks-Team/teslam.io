import type { Metadata } from "next";
import { GenesisConfirmPage } from "@/components/pages/genesis-confirm";
import { getGenesis } from "@/lib/i18n";
import { SITE } from "@/lib/site";

const t = getGenesis("ko").confirm;

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
  alternates: {
    canonical: `${SITE}/genesis/confirm`,
    languages: { ko: `${SITE}/genesis/confirm`, en: `${SITE}/en/genesis/confirm`, "x-default": `${SITE}/genesis/confirm` },
  },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <GenesisConfirmPage locale="ko" />;
}
