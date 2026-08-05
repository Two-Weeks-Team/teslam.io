import model from "@/data/model.json";

export const dynamic = "force-static";

/**
 * The raw inputs, served as-is. Everything on the site is derived from this
 * object, so publishing it is what makes the figures checkable rather than
 * merely stated.
 */
export function GET(): Response {
  return new Response(JSON.stringify(model, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
