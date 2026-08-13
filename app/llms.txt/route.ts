import { renderLlmsTxt } from "@/lib/machine";
import { deriveAt } from "@/lib/economics";
import { getFx } from "@/lib/fx";

/**
 * Revalidated on the same hour as the pages. A machine reader and a human
 * reader must be quoted the same exchange rate, or the mirror stops being a
 * mirror.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const fx = await getFx();
  return new Response(renderLlmsTxt(deriveAt(fx.rate)), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
