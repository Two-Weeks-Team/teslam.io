import { TESLA_PUBLIC_KEY_PEM, looksLikeTeslaPublicKey } from "@/lib/tesla";

/**
 * Serve the application's public key to Tesla.
 *
 * Reached through a rewrite from `/.well-known/appspecific/
 * com.tesla.3p.public-key.pem`, which is the path Fleet API polls. A rewrite
 * rather than a file in `public/`: a dot-prefixed directory is the kind of thing
 * a framework upgrade quietly stops serving, and the failure mode is Fleet API
 * deciding the application is no longer registered.
 *
 * Static, and deliberately cached hard. This value changes exactly once in the
 * life of the application — when the key is rotated, which invalidates every
 * vehicle configuration anyway.
 */
export const dynamic = "force-static";

export function GET(): Response {
  // 404 rather than an empty 200. Tesla reads whatever is at this path at
  // registration time, and a blank body registers a blank key — a failure that
  // succeeds now and is discovered when a car declines to pair.
  if (!TESLA_PUBLIC_KEY_PEM || !looksLikeTeslaPublicKey(TESLA_PUBLIC_KEY_PEM)) {
    return new Response("no key published\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(`${TESLA_PUBLIC_KEY_PEM.trim()}\n`, {
    status: 200,
    headers: {
      "content-type": "application/x-pem-file",
      "cache-control": "public, max-age=3600",
    },
  });
}
