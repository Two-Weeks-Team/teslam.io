/**
 * The same proof as stellar-flow.mjs, on Base Sepolia.
 *
 * Same three properties: DRV accrues off-chain, the withdrawal is
 * non-custodial, and the reader pays nothing. Same amounts, from the same
 * `data/model.json`. The only thing being varied is the chain, which is the
 * point — a comparison where two things differ tells you nothing.
 *
 *     cd scripts/chain && npm install
 *     node base-flow.mjs
 *
 * Needs a funded key in `.dev.vars` as `BASE_SEPOLIA_KEY`, because unlike
 * Stellar's Friendbot every route to Base Sepolia ETH is gated behind a
 * CAPTCHA or an API key. That difference is a fact about developer experience
 * and not a reason to choose a chain, but it is why this file cannot fund
 * itself and the other one can.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  encodePacked,
  formatEther,
  http,
  keccak256,
  parseUnits,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/* ── the model decides the amounts, here as there ─────────────────────── */

const model = JSON.parse(readFileSync(resolve(HERE, "../../data/model.json"), "utf8"));
const { given, assumed } = model;
const DECIMALS = 7;
const perMonth =
  Math.min((assumed.avgKmPerMonth / given.daysPerMonth) * given.drvPerKm, given.dailyCapDrv) *
  given.daysPerMonth;
const EARNED = perMonth * given.genesisRewardMultiplier;
const SUPPLY = EARNED * given.genesisSeats;

/* ── compile ──────────────────────────────────────────────────────────── */

function compile() {
  const solc = require("solc");
  const source = readFileSync(resolve(HERE, "contracts.sol"), "utf8");
  const out = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "contracts.sol": { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  );
  const fatal = (out.errors ?? []).filter((e) => e.severity === "error");
  if (fatal.length) throw new Error(fatal.map((e) => e.formattedMessage).join("\n"));
  const at = (n) => ({
    abi: out.contracts["contracts.sol"][n].abi,
    bytecode: `0x${out.contracts["contracts.sol"][n].evm.bytecode.object}`,
  });
  return { Drv: at("Drv"), Distributor: at("Distributor") };
}

/* ── the tree ─────────────────────────────────────────────────────────── */

/**
 * A settlement is a list of (index, address, amount) and one 32-byte root.
 *
 * Which is the whole reason a Merkle tree is here rather than a payment per
 * reader: five hundred withdrawals cost one root, and the operator publishes
 * a commitment rather than five hundred transactions.
 */
const leafOf = (index, account, amount) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [BigInt(index), account, amount],
    ),
  );
// Doubled, so a leaf can never be mistaken for an internal node.
const leafHash = (...a) => keccak256(leafOf(...a));
const pairHash = (a, b) =>
  a < b ? keccak256(encodePacked(["bytes32", "bytes32"], [a, b]))
        : keccak256(encodePacked(["bytes32", "bytes32"], [b, a]));

function tree(leaves) {
  const levels = [leaves];
  while (levels.at(-1).length > 1) {
    const below = levels.at(-1);
    const up = [];
    for (let i = 0; i < below.length; i += 2) {
      up.push(i + 1 < below.length ? pairHash(below[i], below[i + 1]) : below[i]);
    }
    levels.push(up);
  }
  return {
    root: levels.at(-1)[0],
    proof(index) {
      const path = [];
      let i = index;
      for (const level of levels.slice(0, -1)) {
        const sibling = i ^ 1;
        if (sibling < level.length) path.push(level[sibling]);
        i >>= 1;
      }
      return path;
    },
  };
}

/* ── run ──────────────────────────────────────────────────────────────── */

const raw = (() => {
  try {
    const vars = readFileSync(resolve(HERE, "../../.dev.vars"), "utf8");
    return vars.match(/^BASE_SEPOLIA_KEY\s*=\s*"?([0-9a-fA-Fx]+)"?/m)?.[1];
  } catch {
    return undefined;
  }
})();
if (!raw) {
  console.error("No BASE_SEPOLIA_KEY in .dev.vars — see scripts/chain/README.md");
  process.exit(1);
}
const key = raw.startsWith("0x") ? raw : `0x${raw}`;

const operator = privateKeyToAccount(key);
// A reader who has never touched this chain and has no ETH. Generated fresh so
// the proof cannot accidentally lean on a funded account.
const reader = privateKeyToAccount(generatePrivateKey());

const transport = http("https://sepolia.base.org");
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account: operator, chain: baseSepolia, transport });

console.log(`model      ${EARNED} DRV per seat per month · ${SUPPLY} DRV for ${given.genesisSeats} seats\n`);
console.log(`operator   ${operator.address}`);
console.log(`reader     ${reader.address}\n`);

const opening = await pub.getBalance({ address: operator.address });
console.log(`operator balance  ${formatEther(opening)} ETH`);
if (opening === 0n) {
  console.error("Operator has no ETH. Fund it and run again.");
  process.exit(1);
}

const { Drv, Distributor } = compile();
const supply = parseUnits(String(SUPPLY), DECIMALS);
const earned = parseUnits(String(EARNED), DECIMALS);

const deploy = async (label, artifact, args) => {
  const hash = await wallet.deployContract({ ...artifact, args });
  const rc = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${label.padEnd(30)} ${rc.contractAddress}  gas ${rc.gasUsed}`);
  return { address: rc.contractAddress, gas: rc.gasUsed };
};

console.log("\n── 1 · deploy DRV with no way to make more ──");
const drv = await deploy("Drv", Drv, [supply, operator.address]);

console.log("\n── 2 · publish the settlement root ──");
/*
 * One reader in this proof, but the tree is built the way a real settlement
 * would be so the proof length is not artificially zero: 500 leaves, the
 * reader at index 0, the rest standing in for the other Genesis seats.
 */
const leaves = [leafHash(0, reader.address, earned)];
for (let i = 1; i < given.genesisSeats; i += 1) {
  const filler = privateKeyToAccount(generatePrivateKey()).address;
  leaves.push(leafHash(i, filler, earned));
}
const t = tree(leaves);
console.log(`  root                           ${t.root}`);
const dist = await deploy("Distributor", Distributor, [drv.address, t.root]);

console.log("\n── 3 · fund the distributor, then let go ──");
const fundHash = await wallet.writeContract({
  address: drv.address,
  abi: Drv.abi,
  functionName: "transfer",
  args: [dist.address, supply],
});
const fundRc = await pub.waitForTransactionReceipt({ hash: fundHash });
console.log(`  ${"transfer supply to distributor".padEnd(30)} gas ${fundRc.gasUsed}`);
console.log("  the distributor has no function that returns tokens to the operator");

console.log("\n── 4 · the reader is paid, and never signs anything ──");
/*
 * `claim` credits `account`, not `msg.sender`, so the operator submits it and
 * pays. The reader needs no ETH, no wallet interaction and no transaction —
 * which is a stronger version of "pays nothing" than the Stellar flow, where
 * the reader at least had to sign.
 */
const proof = t.proof(0);
const claimHash = await wallet.writeContract({
  address: dist.address,
  abi: Distributor.abi,
  functionName: "claim",
  args: [0n, reader.address, earned, proof],
});
const claimRc = await pub.waitForTransactionReceipt({ hash: claimHash });
console.log(`  ${"operator claims for the reader".padEnd(30)} gas ${claimRc.gasUsed}  proof ${proof.length} nodes`);

console.log("\n── what the network says afterwards ──");
const read = (fn, args) => pub.readContract({ address: drv.address, abi: Drv.abi, functionName: fn, args });
const [readerDrv, distDrv, total, readerEth, closing] = await Promise.all([
  read("balanceOf", [reader.address]),
  read("balanceOf", [dist.address]),
  read("totalSupply", []),
  pub.getBalance({ address: reader.address }),
  pub.getBalance({ address: operator.address }),
]);
const fmt = (v) => (Number(v) / 10 ** DECIMALS).toLocaleString("en-US", { minimumFractionDigits: 7 });

console.log(`  reader        ${fmt(readerDrv).padStart(16)} DRV`);
console.log(`  reader        ${formatEther(readerEth).padStart(16)} ETH   ← never held gas`);
console.log(`  distributor   ${fmt(distDrv).padStart(16)} DRV`);
console.log(`  total supply  ${fmt(total).padStart(16)} DRV   (no mint function exists)`);
console.log(`  operator paid ${formatEther(opening - closing).padStart(16)} ETH  over 4 transactions`);
console.log(
  `  gas           deploy ${drv.gas + dist.gas} · fund ${fundRc.gasUsed} · claim ${claimRc.gasUsed}`,
);

console.log("\n── check it yourself ──");
console.log(`  DRV          https://sepolia.basescan.org/address/${drv.address}`);
console.log(`  distributor  https://sepolia.basescan.org/address/${dist.address}`);
console.log(`  reader       https://sepolia.basescan.org/address/${reader.address}`);

const ok = readerDrv === earned && readerEth === 0n && total === supply;
if (!ok) {
  console.error("\n✗ the flow did not hold");
  process.exit(1);
}
console.log("\n✓ reader holds the asset, never held gas, and the supply is sealed");
