import { renderMarkdown } from "@/lib/machine";
import { LOCALES, type Locale } from "@/lib/i18n";

export const dynamic = "force-static";

/** `/index.md` and `/en/index.md` rewrite here — see next.config.ts. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;

  if (!(LOCALES as readonly string[]).includes(locale)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(renderMarkdown(locale as Locale), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
