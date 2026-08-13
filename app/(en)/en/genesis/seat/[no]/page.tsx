import type { Metadata } from "next";
import { GenesisSeatPage } from "@/components/pages/genesis-seat";
import { getGenesis } from "@/lib/i18n";

type Params = { params: Promise<{ no: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { no } = await params;
  const t = getGenesis("en");
  return {
    title: `${t.seatPage.title} #${no} — teslam.io`,
    description: t.seatPage.note,
    // Five hundred near-identical pages are not search results. The card still
    // renders for anyone the link is shared with, which is the point.
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: Params) {
  const { no } = await params;
  return <GenesisSeatPage locale="en" no={no} />;
}
