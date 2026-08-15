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
 * Needs a funded key in `scripts/chain/.env.local` as `BASE_SEPOLIA_KEY`,
 * because unlike Stellar's Friendbot every route to Base Sepolia ETH is gated
 * behind a CAPTCHA or a credential — `cdp-fund.mjs` walks the credential one.
 * That difference is a fact about developer experience rather than a reason to
 * choose a chain, but it is why this file cannot fund itself and the other one
 * can.
 */

import { readFileSync, writeFileSync } from "node:fs";
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
    const vars = readFileSync(resolve(HERE, ".env.local"), "utf8");
    return vars.match(/^BASE_SEPOLIA_KEY\s*=\s*"?(0x[0-9a-fA-F]{64})"?/m)?.[1];
  } catch {
    return undefined;
  }
})();
if (!raw) {
  console.error("No BASE_SEPOLIA_KEY in scripts/chain/.env.local — copy .env.local.example");
  process.exit(1);
}
const key = raw;

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
/*
 * Fixed to the asset's precision before it becomes an amount.
 *
 * EARNED and SUPPLY come out of a division, so they are floats — and a float
 * with more than seven places is not a DRV amount. `parseUnits` rounds it away
 * silently, which is the failure that does not announce itself.
 */
const supply = parseUnits(SUPPLY.toFixed(DECIMALS), DECIMALS);
const earned = parseUnits(EARNED.toFixed(DECIMALS), DECIMALS);

/*
 * A receipt is not a success.
 *
 * `waitForTransactionReceipt` resolves for a reverted transaction exactly as
 * it does for a successful one — the status is in the receipt, and a script
 * that does not read it will happily carry on building on top of something
 * that did not happen. Checked here once so no call site can forget.
 */
/** Every transaction this run submitted, so the result is auditable later. */
const steps = [];

const confirm = async (hash, label) => {
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`${label} reverted — ${hash}`);
  steps.push({ label, hash, block: Number(rc.blockNumber), gas: Number(rc.gasUsed) });
  return rc;
};

/*
 * Read until the node agrees, rather than reading once.
 *
 * `sepolia.base.org` is load balanced and eventually consistent: the node that
 * hands back a receipt is not the node that answers the next call. Reading
 * immediately after a write therefore returns the state from before it, which
 * cost an hour here — a freshly deployed contract answered "returned no data",
 * which reads exactly like a wrong ABI, and a funded distributor read as empty,
 * which reads exactly like a transfer that failed. Neither was true. Both were
 * a question asked of a node that had not caught up.
 */
const settle = async (read, ok, what) => {
  let last;
  let fault;
  for (let i = 0; i < 40; i += 1) {
    try {
      last = await read();
      if (ok(last)) return last;
      fault = undefined;
    } catch (err) {
      /*
       * The retry has to cover the throw, not just the wrong answer.
       *
       * This is the case the whole helper exists for and the first version of
       * it missed: `readContract` against a contract the node has not seen yet
       * does not return something falsy, it throws
       * `ContractFunctionZeroDataError`. Awaiting outside a try meant the very
       * first attempt propagated and the polling never happened — a guard that
       * looked like protection and was not. Caught by review, not by the runs,
       * because by the time these reads happen the nodes have usually caught
       * up and the bug only shows on a bad day.
       */
      fault = err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${what} never settled — ${fault ? `last threw ${fault.shortMessage ?? fault.message}` : `last saw ${last}`}`);
};

const deploy = async (label, artifact, args) => {
  const hash = await wallet.deployContract({ ...artifact, args });
  const rc = await confirm(hash, label);
  await settle(
    () => pub.getBytecode({ address: rc.contractAddress }),
    (code) => code && code !== "0x",
    `code at ${rc.contractAddress}`,
  );
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
const fundRc = await confirm(fundHash, "funding transfer");
await settle(
  () => pub.readContract({ address: drv.address, abi: Drv.abi, functionName: "balanceOf", args: [dist.address] }),
  (held) => held === supply,
  "distributor balance",
);
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

/*
 * Simulate before paying.
 *
 * A reverted transaction still costs gas and tells you almost nothing on the
 * way out — viem prints the calldata and the ABI and buries the one line that
 * matters. `simulateContract` runs it against the current state for free and
 * comes back with the require string.
 */
const held = await pub.readContract({ address: drv.address, abi: Drv.abi, functionName: "balanceOf", args: [dist.address] });
const onChainRoot = await pub.readContract({ address: dist.address, abi: Distributor.abi, functionName: "root" });
console.log(`  distributor holds ${held} · root on chain ${onChainRoot === t.root ? "matches ✓" : "DIFFERS ✗ " + onChainRoot}`);
try {
  await pub.simulateContract({
    account: operator, address: dist.address, abi: Distributor.abi,
    functionName: "claim", args: [0n, reader.address, earned, proof],
  });
} catch (err) {
  console.error(`\n✗ claim would revert: ${err.shortMessage ?? err.message}`);
  if (err.metaMessages) console.error("  " + err.metaMessages.slice(0, 3).join("\n  "));
  process.exit(1);
}

const claimHash = await wallet.writeContract({
  address: dist.address,
  abi: Distributor.abi,
  functionName: "claim",
  args: [0n, reader.address, earned, proof],
});
const claimRc = await confirm(claimHash, "claim");
console.log(`  ${"operator claims for the reader".padEnd(30)} gas ${claimRc.gasUsed}  proof ${proof.length} nodes`);

console.log("\n── what the network says afterwards ──");
const read = (fn, args) => pub.readContract({ address: drv.address, abi: Drv.abi, functionName: fn, args });
/*
 * Settle here too. The claim is the last write and these are the reads that
 * decide whether the whole thing passed, so a stale answer here reports a
 * working system as broken — which is what happened, and is the more
 * dangerous direction only because the other one is worse.
 */
const readerDrv = await settle(
  () => read("balanceOf", [reader.address]),
  (v) => v === earned,
  "reader balance",
);
const [distDrv, total, readerEth, closing] = await Promise.all([
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
console.log(`  operator paid ${formatEther(opening - closing).padStart(16)} ETH  over ${steps.length} transactions`);
console.log(
  `  gas           deploy ${drv.gas + dist.gas} · fund ${fundRc.gasUsed} · claim ${claimRc.gasUsed}`,
);

console.log("\n── check it yourself ──");
console.log(`  DRV          https://sepolia.basescan.org/address/${drv.address}`);
console.log(`  distributor  https://sepolia.basescan.org/address/${dist.address}`);
console.log(`  reader       https://sepolia.basescan.org/address/${reader.address}`);
console.log(`  operator     https://sepolia.basescan.org/address/${operator.address}`);

console.log("\n── every transaction, in order ──");
for (const st of steps) {
  console.log(`  ${st.label.padEnd(30)} https://sepolia.basescan.org/tx/${st.hash}`);
}

const block = await pub.getBlockNumber();
writeFileSync(resolve(HERE, "base-result.json"), JSON.stringify({
  network: "base-sepolia",
  chainId: baseSepolia.id,
  rpc: "https://sepolia.base.org",
  explorer: "https://sepolia.basescan.org",
  measuredAtBlock: Number(block),
  contracts: { drv: drv.address, distributor: dist.address },
  accounts: { operator: operator.address, reader: reader.address },
  settlementRoot: t.root,
  leaves: given.genesisSeats,
  proofLength: proof.length,
  holdings: {
    readerDrv: fmt(readerDrv), readerEth: formatEther(readerEth),
    distributorDrv: fmt(distDrv), totalSupply: fmt(total),
  },
  cost: {
    ethSpent: formatEther(opening - closing),
    transactions: steps.length,
    gas: Object.fromEntries(steps.map((st) => [st.label, st.gas])),
  },
  transactions: steps,
}, null, 2));

const ok = readerDrv === earned && readerEth === 0n && total === supply;
if (!ok) {
  console.error("\n✗ the flow did not hold");
  process.exit(1);
}
console.log("\n✓ reader holds the asset, never held gas, and the supply is sealed");
