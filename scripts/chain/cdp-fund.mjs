/**
 * Fund the Base Sepolia operator through CDP's API, because every other route
 * is a door with a person-shaped lock on it.
 *
 * Seven faucets were tried before this file existed. Stellar's Friendbot
 * handed over 10,000 XLM to a bare HTTP GET; the other six wanted a CAPTCHA, a
 * human-verification challenge, or a credential — and those gates are the
 * faucets working correctly, so none of them were worth defeating to save five
 * minutes. Coinbase publishes the intended programmatic route instead, which
 * is this: an API key, and `requestFaucet` on the other side of it.
 *
 *     cd scripts/chain && npm install
 *     node cdp-fund.mjs
 *
 * Credentials come from `scripts/chain/.env.local`, which is gitignored — see
 * `.env.local.example` next to this file. Nothing here prints a secret, and nothing
 * writes one anywhere.
 *
 * Two ways this can go, and it tries them in order:
 *
 *   `requestFaucet` may fund any address, in which case the key that
 *   `base-flow.mjs` already uses gets topped up and there is nothing else to
 *   do.
 *
 *   Or it may only fund accounts CDP itself holds, in which case one is
 *   created, funded, and asked to forward the ETH on. That path needs
 *   `CDP_WALLET_SECRET` as well, because forwarding means signing.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import dotenv from "dotenv";

const HERE = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(HERE, ".env.local"), quiet: true });

const need = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing ${missing.join(", ")} in scripts/chain/.env.local`);
  console.error("See scripts/chain/.env.local.example — create the file yourself, do not paste the values into a chat.");
  process.exit(1);
}

/*
 * Where the ETH should end up.
 *
 * `base-flow.mjs` reads BASE_SEPOLIA_KEY and deploys from it, so funding that
 * same account is what makes the two scripts one workflow rather than two
 * things that happen to touch the same chain.
 */
const keyFile = resolve(HERE, ".env.local");
const rawKey = existsSync(keyFile)
  ? readFileSync(keyFile, "utf8").match(/^BASE_SEPOLIA_KEY\s*=\s*"?(0x[0-9a-fA-F]{64})"?/m)?.[1]
  : undefined;
if (!rawKey) {
  console.error("Missing BASE_SEPOLIA_KEY in scripts/chain/.env.local — see .env.local.example");
  process.exit(1);
}
const operator = privateKeyToAccount(rawKey);

const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });
const before = await pub.getBalance({ address: operator.address });

console.log(`operator   ${operator.address}`);
console.log(`before     ${formatEther(before)} ETH\n`);

const cdp = new CdpClient();

/** Poll rather than sleep: the chain is the authority on whether it arrived. */
async function waitForRise(from, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const now = await pub.getBalance({ address: operator.address });
    if (now > from) return now;
    if (Date.now() > deadline) return now;
    await new Promise((r) => setTimeout(r, 4000));
  }
}

let funded = false;
try {
  console.log("── asking the faucet to pay the operator directly ──");
  const { transactionHash } = await cdp.evm.requestFaucet({
    address: operator.address,
    network: "base-sepolia",
    token: "eth",
  });
  console.log(`  tx ${transactionHash}`);
  await pub.waitForTransactionReceipt({ hash: transactionHash });
  funded = true;
} catch (err) {
  console.log(`  refused: ${String(err.message ?? err).slice(0, 160)}`);
  console.log("\n── falling back: fund a CDP account, then forward ──");
  if (!process.env.CDP_WALLET_SECRET) {
    console.error("  This path signs a transaction, so it needs CDP_WALLET_SECRET too. See .env.local.example.");
    process.exit(1);
  }
  const account = await cdp.evm.getOrCreateAccount({ name: "teslam-spike-funder" });
  console.log(`  cdp account ${account.address}`);

  const { transactionHash: faucetHash } = await cdp.evm.requestFaucet({
    address: account.address,
    network: "base-sepolia",
    token: "eth",
  });
  await pub.waitForTransactionReceipt({ hash: faucetHash });
  // The API's own balance view lags the chain; forwarding before it catches up
  // fails as "insufficient funds" on an account that demonstrably has some.
  await new Promise((r) => setTimeout(r, 10_000));

  const held = await pub.getBalance({ address: account.address });
  /*
   * Leave behind what the forwarding actually costs, measured.
   *
   * This was a typed-in 0.0005 ETH, which is several orders of magnitude above
   * a Base Sepolia transfer and five times what the faucet pays — so the
   * subtraction went negative every time and this branch could only ever
   * report "not enough to forward". A fallback that cannot run is not a
   * fallback. A plain transfer is 21,000 gas; tripled for headroom against a
   * price move between the quote and the send.
   */
  const gasPrice = await pub.getGasPrice();
  const reserve = 21_000n * gasPrice * 3n;
  const send = held - reserve;
  if (send <= 0n) {
    console.error(`  faucet paid ${formatEther(held)} ETH, forwarding needs ${formatEther(reserve)} — not enough`);
    process.exit(1);
  }
  const { transactionHash: sendHash } = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: { to: operator.address, value: send },
    network: "base-sepolia",
  });
  console.log(`  forwarding ${formatEther(send)} ETH — tx ${sendHash}`);
  await pub.waitForTransactionReceipt({ hash: sendHash });
  funded = true;
}

const after = await waitForRise(before);
console.log(`\nafter      ${formatEther(after)} ETH`);
console.log(`received   ${formatEther(after - before)} ETH`);
console.log(`explorer   https://sepolia.basescan.org/address/${operator.address}`);

if (!funded || after <= before) {
  console.error("\n✗ nothing arrived");
  process.exit(1);
}
console.log("\n✓ funded — now run: node base-flow.mjs");
