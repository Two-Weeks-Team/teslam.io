import type { Metadata } from "next";
import { BoardPage } from "@/components/pages/board";
import { getContent } from "@/lib/i18n";

type Props = { searchParams: Promise<{ board?: string; sort?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = getContent("en").feed;
  return { title: `${t.pageTitle} — teslam.io`, description: t.pageDescription };
}

export default async function Page({ searchParams }: Props) {
  return <BoardPage locale="en" search={await searchParams} />;
}
