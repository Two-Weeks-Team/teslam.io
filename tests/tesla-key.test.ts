import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/tesla-public-key/route";
import {
  TESLA_PUBLIC_KEY_PEM,
  TESLA_PUBLIC_KEY_PATH,
  looksLikeTeslaPublicKey,
} from "@/lib/tesla";
import nextConfig from "@/next.config";

/**
 * The one path Tesla polls.
 *
 * Fleet API decides whether this application is registered by fetching a key
 * from a fixed URL, and its documentation says the key "must be and remain
 * hosted" there. The failure this file guards is the quiet one: the path stops
 * resolving, or starts serving something that is not a key, and nothing breaks
 * on teslam.io at all — vehicles simply stop being configurable, reported by
 * Tesla as "application not registered".
 */

const p256 = () =>
  generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    privateKeyEncoding: { type: "sec1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

describe("the key Tesla asked for", () => {
  it("accepts a real P-256 public key", () => {
    expect(looksLikeTeslaPublicKey(p256().publicKey)).toBe(true);
  });

  /**
   * The mistake worth catching, because it is one keystroke away and its
   * consequence is disclosure rather than an error.
   */
  it("refuses a private key", () => {
    expect(looksLikeTeslaPublicKey(p256().privateKey)).toBe(false);
  });

  it("refuses a key from a different algorithm", () => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    expect(looksLikeTeslaPublicKey(publicKey)).toBe(false);
  });

  it("refuses a truncated file", () => {
    const { publicKey } = p256();
    expect(looksLikeTeslaPublicKey(publicKey.slice(0, 60))).toBe(false);
  });
});

describe("the route", () => {
  it("is reachable at the exact path Tesla polls", () => {
    // A rewrite, not a file in `public/` — the destination has to exist and the
    // source has to be spelled the way Tesla spells it. A typo here is a 404
    // that nobody sees until registration fails.
    const rewrites = nextConfig.rewrites?.();
    return Promise.resolve(rewrites).then((rules) => {
      const list = Array.isArray(rules) ? rules : [];
      const rule = list.find((r) => r.source === TESLA_PUBLIC_KEY_PATH);
      expect(rule, `no rewrite for ${TESLA_PUBLIC_KEY_PATH}`).toBeTruthy();
      expect(rule!.destination).toBe("/api/tesla-public-key");
    });
  });

  /**
   * While no pair has been generated the route must refuse rather than serve an
   * empty body. Tesla reads whatever is there at registration time, and a blank
   * 200 registers a blank key — a failure that succeeds now and surfaces when a
   * car declines to pair.
   */
  it("serves 404 rather than an empty key", async () => {
    const res = GET();
    if (TESLA_PUBLIC_KEY_PEM === null) {
      expect(res.status).toBe(404);
      return;
    }

    // Once the key exists this is the branch that runs, and it asserts the
    // things Tesla actually checks.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-pem-file");
    const body = await res.text();
    expect(looksLikeTeslaPublicKey(body)).toBe(true);
    expect(body.endsWith("\n"), "PEM must end with a newline").toBe(true);
  });

  it("never serves a private key, whatever the constant holds", async () => {
    const body = await GET().text();
    expect(body).not.toContain("PRIVATE KEY");
  });
});
