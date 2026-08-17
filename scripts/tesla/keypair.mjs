#!/usr/bin/env node
/**
 * Generate the application key pair Tesla requires.
 *
 *     node scripts/tesla/keypair.mjs
 *
 * Fleet API wants a PEM-encoded EC key on the secp256r1 (prime256v1) curve. The
 * public half is published at `/.well-known/appspecific/
 * com.tesla.3p.public-key.pem`; the private half signs vehicle commands and
 * fleet telemetry configurations through the vehicle-command proxy.
 *
 * The private key is written **outside the repository** — `~/.secrets/teslam/`
 * by default — and this script refuses to put it anywhere inside the working
 * tree. A private key that reaches a git index has to be treated as disclosed,
 * and rotating this one means re-pairing every vehicle that already trusts it.
 *
 * The public half is printed and written into `lib/tesla.ts`, because Tesla's
 * requirement is that it "remain hosted": a value in the repository is one that
 * cannot go missing between deployments.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SECRETS = process.env.TESLA_KEY_DIR ?? join(homedir(), ".secrets", "teslam");
const PRIVATE = join(SECRETS, "private-key.pem");
const PUBLIC = join(SECRETS, "public-key.pem");
const CONSTANT = join(REPO, "lib", "tesla.ts");

const die = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

// The check that matters most here, and the cheapest to get wrong: a
// `TESLA_KEY_DIR` pointing anywhere under the repository would put the private
// key one `git add -A` away from being published.
if (!relative(REPO, resolve(SECRETS)).startsWith("..")) {
  die(
    `refusing to write a private key inside the repository (${SECRETS}).\n` +
      `  Set TESLA_KEY_DIR to a path outside ${REPO}.`,
  );
}

if (existsSync(PRIVATE)) {
  die(
    `${PRIVATE} already exists.\n` +
      `  Overwriting it would orphan every vehicle already paired with it.\n` +
      `  Delete it deliberately if you mean to rotate.`,
  );
}

const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "sec1", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
writeFileSync(PRIVATE, privateKey, { mode: 0o600 });
writeFileSync(PUBLIC, publicKey, { mode: 0o644 });

// Splice the public key into the constant rather than asking somebody to paste
// it. A hand-pasted PEM loses a newline about a third of the time, and the
// resulting key parses everywhere except on a vehicle.
const source = readFileSync(CONSTANT, "utf8");
const literal = `\`${publicKey.trim()}\``;
const updated = source.replace(
  /export const TESLA_PUBLIC_KEY_PEM: string \| null = [\s\S]*?;\n/,
  `export const TESLA_PUBLIC_KEY_PEM: string | null = ${literal};\n`,
);
if (updated === source) {
  die(`could not find TESLA_PUBLIC_KEY_PEM in ${CONSTANT} — was it renamed?`);
}
writeFileSync(CONSTANT, updated);

console.log(`
  private key   ${PRIVATE}   (0600, outside the repo)
  public key    ${PUBLIC}
  published in  lib/tesla.ts

${publicKey.trim()}

Next:
  1. pnpm build && deploy, then confirm the path serves it:
       curl -s https://teslam.io/.well-known/appspecific/com.tesla.3p.public-key.pem
  2. register the application (docs/tesla-app-registration.md, step 5)
  3. keep ${PRIVATE} backed up somewhere that is not a laptop
`);
