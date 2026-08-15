/**
 * Ask both networks what is true right now.
 *
 * Nothing here is remembered. It reads the run records written by
 * `stellar-flow.mjs` and `base-flow.mjs` for the addresses, and then goes and
 * asks the chains for every figure — so a number in this output is a number a
 * chain said, not one a previous run printed. That distinction is the whole
 * point: the reason the Base debugging took an afternoon is that a stale read
 * looks exactly like a broken system, and the only defence is to keep asking.
 *
 *     node scripts/chain/status.mjs
 *
 * Read-only, free, and needs no credentials.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Horizon } from "@stellar/stellar-sdk";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { baseSepolia } from "viem/chains";

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (name) => {
  const p = resolve(HERE, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};

const stellar = load("stellar-result.json");
const base = load("base-result.json");
if (!stellar && !base) {
  console.error("No run records. Run stellar-flow.mjs and/or base-flow.mjs first.");
  process.exit(1);
}

const pad = (k, v) => console.log(`  ${String(k).padEnd(24)} ${v}`);

if (stellar) {
  console.log("STELLAR TESTNET");
  const hz = new Horizon.Server(stellar.horizon);
  const [ledger] = (await hz.ledgers().order("desc").limit(1).call()).records;
  pad("horizon", stellar.horizon);
  pad("latest ledger", `${ledger.sequence}   ${ledger.closed_at}`);
  pad("base reserve", `${Number(ledger.base_reserve_in_stroops) / 1e7} XLM`);
  pad("base fee", `${Number(ledger.base_fee_in_stroops) / 1e7} XLM`);

  for (const [role, id] of Object.entries(stellar.accounts)) {
    const a = await hz.loadAccount(id);
    const drv = a.balances.find((b) => b.asset_code === "DRV")?.balance ?? "—";
    const xlm = a.balances.find((b) => b.asset_type === "native").balance;
    pad(role, `DRV ${String(drv).padStart(16)}   XLM ${String(xlm).padStart(15)}`);
    if (role === "issuer") {
      const weights = a.signers.map((s) => s.weight);
      const sealed = weights.every((w) => w === 0);
      pad("  signer weights", `${weights.join(",")}  →  ${sealed ? "cannot sign · supply sealed" : "CAN STILL MINT ✗"}`);
    }
  }
  pad("asset", `DRV:${stellar.asset.issuer}`);
  console.log();
}

if (base) {
  console.log("BASE SEPOLIA");
  const pub = createPublicClient({ chain: baseSepolia, transport: http(base.rpc) });
  const erc = [
    { inputs: [{ type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "totalSupply", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  ];
  const dist = [
    { inputs: [], name: "root", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
    { inputs: [{ type: "uint256" }], name: "claimed", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  ];
  const drv = base.contracts.drv;
  const [block, gasPrice, dec, total, readerDrv, distDrv, root, c0, c1, readerEth, opEth] = await Promise.all([
    pub.getBlockNumber(),
    pub.getGasPrice(),
    pub.readContract({ address: drv, abi: erc, functionName: "decimals" }),
    pub.readContract({ address: drv, abi: erc, functionName: "totalSupply" }),
    pub.readContract({ address: drv, abi: erc, functionName: "balanceOf", args: [base.accounts.reader] }),
    pub.readContract({ address: drv, abi: erc, functionName: "balanceOf", args: [base.contracts.distributor] }),
    pub.readContract({ address: base.contracts.distributor, abi: dist, functionName: "root" }),
    pub.readContract({ address: base.contracts.distributor, abi: dist, functionName: "claimed", args: [0n] }),
    pub.readContract({ address: base.contracts.distributor, abi: dist, functionName: "claimed", args: [1n] }),
    pub.getBalance({ address: base.accounts.reader }),
    pub.getBalance({ address: base.accounts.operator }),
  ]);
  pad("rpc", base.rpc);
  pad("chain id", baseSepolia.id);
  pad("latest block", block);
  pad("gas price", `${Number(gasPrice) / 1e9} gwei`);
  pad("DRV totalSupply", `${formatUnits(total, dec)}  (decimals ${dec})`);
  pad("reader", `DRV ${formatUnits(readerDrv, dec).padStart(16)}   ETH ${formatEther(readerEth)}`);
  pad("distributor", `DRV ${formatUnits(distDrv, dec).padStart(16)}`);
  pad("settlement root", `${root}  ${root === base.settlementRoot ? "= recorded ✓" : "≠ RECORDED ✗"}`);
  pad("claimed[0] / [1]", `${c0} / ${c1}   ${c0 && !c1 ? "· only the claimant spent ✓" : ""}`);
  pad("operator ETH left", formatEther(opEth));
  console.log();
}

console.log("EXPLORERS");
if (stellar) {
  for (const [role, id] of Object.entries(stellar.accounts)) {
    pad(`stellar ${role}`, `https://stellar.expert/explorer/testnet/account/${id}`);
  }
}
if (base) {
  for (const [role, a] of Object.entries({ ...base.contracts, ...base.accounts })) {
    pad(`base ${role}`, `https://sepolia.basescan.org/address/${a}`);
  }
}
