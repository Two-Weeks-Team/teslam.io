/**
 * Everything that can be checked without a faucet.
 *
 * Worth doing before spending somebody's testnet ETH: the two things most
 * likely to be wrong here are the Solidity compiling and the Merkle
 * convention, and neither needs a chain to find out about. The proof
 * verification below is a deliberate second implementation of the loop inside
 * `Distributor.claim` — if the two agree, the on-chain call will too.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { encodeAbiParameters, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const require = createRequire(import.meta.url);
const solc = require("solc");
// Resolved from this file, not from wherever it was invoked: the README tells
// you to run it from the repository root.
const HERE = dirname(fileURLToPath(import.meta.url));

const out = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "contracts.sol": { content: readFileSync(resolve(HERE, "contracts.sol"), "utf8") } },
  settings: { optimizer: { enabled: true, runs: 200 },
              outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] } } },
})));
const errs = (out.errors ?? []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
/*
 * EIP-170 caps the *runtime* code, not the creation code.
 *
 * `evm.bytecode` is what runs to deploy; `evm.deployedBytecode` is what is left
 * on chain and what the limit applies to. Measuring the first is measuring the
 * wrong artefact — generously, since creation code is the larger of the two, so
 * the check was strict in the safe direction and still wrong. And it printed a
 * warning without affecting the exit code, so a contract over the limit would
 * have reported success.
 */
const EIP170 = 24_576;
let oversize = 0;
for (const n of ["Drv", "Distributor"]) {
  const art = out.contracts["contracts.sol"][n].evm;
  const runtime = (art.deployedBytecode?.object ?? "").length / 2;
  const creation = art.bytecode.object.length / 2;
  const over = runtime > EIP170;
  if (over) oversize += 1;
  console.log(
    `compiled  ${n.padEnd(12)} runtime ${runtime} bytes (creation ${creation})` +
      (over ? `  ✗ over the EIP-170 limit of ${EIP170}` : ""),
  );
}
for (const w of (out.errors ?? []).filter((e) => e.severity === "warning").slice(0, 4)) {
  console.log("warning  ", w.message.split("\n")[0]);
}

const leafHash = (i, a, amt) => keccak256(keccak256(encodeAbiParameters(
  [{ type: "uint256" }, { type: "address" }, { type: "uint256" }], [BigInt(i), a, amt])));
const pair = (a, b) => a < b
  ? keccak256(encodePacked(["bytes32","bytes32"], [a, b]))
  : keccak256(encodePacked(["bytes32","bytes32"], [b, a]));

function tree(leaves) {
  const levels = [leaves];
  while (levels.at(-1).length > 1) {
    const below = levels.at(-1); const up = [];
    for (let i = 0; i < below.length; i += 2)
      up.push(i + 1 < below.length ? pair(below[i], below[i + 1]) : below[i]);
    levels.push(up);
  }
  return { root: levels.at(-1)[0], proof(index) {
    const path = []; let i = index;
    for (const level of levels.slice(0, -1)) { const s = i ^ 1; if (s < level.length) path.push(level[s]); i >>= 1; }
    return path;
  } };
}

const N = 500, AMT = 180000000000n;
const accounts = Array.from({ length: N }, () => privateKeyToAccount(generatePrivateKey()).address);
const leaves = accounts.map((a, i) => leafHash(i, a, AMT));
const t = tree(leaves);
console.log(`\ntree      ${N} leaves, root ${t.root.slice(0, 18)}…`);

/** The loop from Distributor.claim, written again on purpose. */
const verifies = (i, account, amount, proof) => {
  let node = leafHash(i, account, amount);
  for (const p of proof) node = pair(node, p);
  return node === t.root;
};

let good = 0;
for (const i of [0, 1, 7, 249, 498, 499]) {
  if (verifies(i, accounts[i], AMT, t.proof(i))) good += 1;
  else console.log(`  ✗ index ${i} failed`);
}
console.log(`proof     ${good}/6 sampled indices verify, path length ${t.proof(0).length}`);

// A proof must not work for a different address, a different amount, or a
// different index. If any of these pass, the scheme is worthless.
const forged = [
  ["wrong account", verifies(0, accounts[1], AMT, t.proof(0))],
  ["wrong amount",  verifies(0, accounts[0], AMT + 1n, t.proof(0))],
  ["wrong index",   verifies(1, accounts[0], AMT, t.proof(0))],
  ["empty proof",   verifies(0, accounts[0], AMT, [])],
];
for (const [what, passed] of forged) console.log(`forgery   ${what.padEnd(14)} ${passed ? "✗ ACCEPTED" : "rejected ✓"}`);

/*
 * And now the check that actually matters.
 *
 * Everything above is JavaScript agreeing with JavaScript. The failure mode
 * this cannot see is the one that costs an afternoon: the Solidity computing a
 * different hash from the JS, which produces a proof that verifies perfectly
 * here and reverts on chain with `proof`. Both sides have to be asked.
 *
 * `readContract` with `code` and no address is a deployless `eth_call` — the
 * EVM runs the constructor and the function in one go and returns the result
 * without anything being deployed. It costs no gas and needs no key, only a
 * public RPC. If the network is not reachable the run says so rather than
 * quietly passing on the strength of the half of the test that ran.
 */
const probe = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract Probe {
  function leaf(uint256 i, address a, uint256 amt) external pure returns (bytes32) {
    return keccak256(bytes.concat(keccak256(abi.encode(i, a, amt))));
  }
  function pair(bytes32 a, bytes32 b) external pure returns (bytes32) {
    return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
  }
}`;
const pout = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity", sources: { "p.sol": { content: probe } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
})));
const art = pout.contracts["p.sol"].Probe;
const code = `0x${art.evm.bytecode.object}`;

const { createPublicClient, http } = await import("viem");
const { baseSepolia } = await import("viem/chains");
const pub = createPublicClient({ chain: baseSepolia, transport: http("https://sepolia.base.org") });

let crossChecked = 0;
try {
  const sLeaf = await pub.readContract({ code, abi: art.abi, functionName: "leaf", args: [0n, accounts[0], AMT] });
  const jLeaf = leafHash(0, accounts[0], AMT);
  console.log(`\nsolidity  leaf  ${sLeaf === jLeaf ? "agrees with JS ✓" : "DISAGREES ✗\n  sol " + sLeaf + "\n  js  " + jLeaf}`);
  crossChecked += sLeaf === jLeaf ? 1 : 0;

  // Both orderings, because the sorted-pair convention is where an
  // implementation usually diverges: JS compares hex strings, Solidity
  // compares bytes32 as unsigned integers, and those agree only because
  // lowercase hex sorts the same way. Worth proving rather than reasoning.
  const A = leaves[0];
  const B = leaves[1];
  for (const [x, y] of [[A, B], [B, A]]) {
    const sp = await pub.readContract({ code, abi: art.abi, functionName: "pair", args: [x, y] });
    const jp = pair(x, y);
    console.log(`solidity  pair  ${sp === jp ? "agrees with JS ✓" : "DISAGREES ✗"}`);
    crossChecked += sp === jp ? 1 : 0;
  }
} catch (err) {
  // Two very different failures wear the same catch block: the RPC being
  // unreachable, and the deployless call running and disagreeing. Saying
  // "could not reach an RPC" for the second would send the next person to
  // check their network when the contract is wrong.
  const msg = String(err.shortMessage ?? err.message ?? err);
  const network = /fetch|network|ECONN|ENOTFOUND|timeout|socket|522|503/i.test(msg);
  console.error(`\n✗ Solidity cross-check did not complete — ${network ? "RPC unreachable" : "the call itself failed"}`);
  console.error(`  ${msg.slice(0, 200)}`);
  console.error("  The JS half passed, which proves nothing about what the chain will compute.");
  process.exit(1);
}

if (forged.some(([, p]) => p) || good !== 6 || crossChecked !== 3 || oversize) process.exit(1);
console.log("\n✓ contracts compile, the Merkle convention holds, and Solidity agrees with the JS");
