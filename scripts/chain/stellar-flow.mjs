/**
 * The withdrawal architecture, proved on a real network.
 *
 * The design this site is heading for has three properties that were agreed
 * before any chain was chosen, and they are the whole reason this script
 * exists rather than a paragraph asserting the same thing:
 *
 *   DRV accrues in an off-chain ledger. Nothing touches a chain while somebody
 *   is driving — a reward that waits on block times is a reward that breaks
 *   when the chain does.
 *
 *   Withdrawal is non-custodial. The operator must never hold a reader's
 *   asset, because holding it is the act that Korean law calls 보관·관리 and
 *   that turns a community board into a registered 가상자산사업자.
 *
 *   The reader pays nothing. Not gas, not a deposit, not a minimum balance.
 *   Somebody who drove to Gangneung should not have to acquire a second asset
 *   in order to collect the first.
 *
 * On an EVM chain that is a Merkle distributor contract plus an ERC-4337
 * paymaster: two pieces of custom Solidity to write, audit, deploy and keep
 * upgradeable. Here it is four protocol operations and no contract at all,
 * which is the finding this script was written to check rather than assume.
 *
 * Run it against testnet and it prints what the network says afterwards, not
 * what it asked for:
 *
 *     node scripts/chain/stellar-flow.mjs
 *
 * It funds itself from Friendbot, so it needs no key, no account and no
 * faucet visit. That property is not a reason to choose a chain, but it is
 * the reason this proof could be run at all — every other candidate's faucet
 * requires a human to pass a CAPTCHA or hold an API key, and defeating an
 * anti-abuse control to save five minutes is not a thing worth doing.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  Asset,
  BASE_FEE,
  Claimant,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));

/*
 * The amounts come from the model, not from this file.
 *
 * `data/model.json` is the single source every published figure on the site is
 * computed from, and a proof that quotes different numbers than the page is
 * proving something about a system nobody is building.
 */
const model = JSON.parse(readFileSync(resolve(HERE, "../../data/model.json"), "utf8"));
const { given, assumed } = model;

const drvPerMonth = Math.min(
  (assumed.avgKmPerMonth / given.daysPerMonth) * given.drvPerKm,
  given.dailyCapDrv,
) * given.daysPerMonth;
/** One Genesis seat, one month. */
const EARNED = String(drvPerMonth * given.genesisRewardMultiplier);
/** Every Genesis seat, one month — the float a distributor would actually hold. */
const SUPPLY = String(Number(EARNED) * given.genesisSeats);

const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";
const server = new Horizon.Server(HORIZON);
const NET = Networks.TESTNET;

async function fund(kp) {
  const res = await fetch(`${FRIENDBOT}/?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`friendbot refused: ${res.status}`);
}

/**
 * Build, sign, submit — and on failure surface the operation result codes
 * rather than a page of HTTP internals. `op_malformed` on operation zero tells
 * you what is wrong; a stack trace through axios does not.
 */
async function submit(source, ops, signers, label) {
  const account = await server.loadAccount(source.publicKey());
  let builder = new TransactionBuilder(account, {
    fee: String(Number(BASE_FEE) * Math.max(1, ops.length)),
    networkPassphrase: NET,
  });
  for (const op of ops) builder = builder.addOperation(op);
  const tx = builder.setTimeout(60).build();
  for (const signer of signers) tx.sign(signer);

  try {
    const res = await server.submitTransaction(tx);
    console.log(`  ${label.padEnd(36)} ${res.hash.slice(0, 16)}…  ledger ${res.ledger}`);
    return res;
  } catch (err) {
    const codes = err?.response?.data?.extras?.result_codes;
    throw new Error(`${label} — ${JSON.stringify(codes ?? err.message)}`);
  }
}

const issuer = Keypair.random();
const distributor = Keypair.random();
const reader = Keypair.random();

console.log(`model      ${EARNED} DRV per seat per month · ${SUPPLY} DRV for ${given.genesisSeats} seats\n`);
console.log(`issuer      ${issuer.publicKey()}`);
console.log(`distributor ${distributor.publicKey()}`);
console.log(`reader      ${reader.publicKey()}\n`);

console.log("── friendbot funds the two operator accounts. The reader gets nothing. ──");
await Promise.all([fund(issuer), fund(distributor)]);
console.log("  funded\n");

const DRV = new Asset("DRV", issuer.publicKey());

console.log("── 1 · issue the supply, then throw away the ability to issue more ──");
await submit(distributor, [Operation.changeTrust({ asset: DRV, limit: SUPPLY })], [distributor], "distributor trusts DRV");
await submit(
  issuer,
  [Operation.payment({ destination: distributor.publicKey(), asset: DRV, amount: SUPPLY })],
  [issuer],
  `mint ${SUPPLY} DRV`,
);
await submit(
  issuer,
  /*
   * Master weight zero, thresholds one: the issuing account can never sign
   * another transaction, so no further DRV can ever exist.
   *
   * This is the operation that matters most. The site already tells readers
   * that the supply is fixed and that nobody will print more, and until now
   * that was a sentence they had to take on trust — from a project whose
   * entire argument is that odometers are better than promises. After this
   * it is a fact anyone can check against the ledger.
   */
  [Operation.setOptions({ masterWeight: 0, lowThreshold: 1, medThreshold: 1, highThreshold: 1 })],
  [issuer],
  "lock the issuer for ever",
);

console.log("\n── 2 · the reader's account, paid for by the operator ──");
/*
 * Sponsored reserves. Stellar requires an account to hold a minimum balance,
 * and another for each trustline — normally the reader's problem, and a fatal
 * one, because it means needing XLM before you can receive DRV. Sponsorship
 * moves both reserves onto the operator's balance sheet where they belong.
 * They are locked rather than spent, and released if the reader ever closes
 * the trustline.
 */
await submit(
  distributor,
  [
    Operation.beginSponsoringFutureReserves({ sponsoredId: reader.publicKey() }),
    Operation.createAccount({ destination: reader.publicKey(), startingBalance: "0" }),
    Operation.endSponsoringFutureReserves({ source: reader.publicKey() }),
  ],
  [distributor, reader],
  "operator sponsors the account",
);
await submit(
  distributor,
  [
    Operation.beginSponsoringFutureReserves({ sponsoredId: reader.publicKey() }),
    Operation.changeTrust({ asset: DRV, source: reader.publicKey() }),
    Operation.endSponsoringFutureReserves({ source: reader.publicKey() }),
  ],
  [distributor, reader],
  "operator sponsors the trustline",
);

console.log("\n── 3 · the withdrawal is an offer, not a transfer ──");
/*
 * No sponsorship wrapper here, and the first version of this script was wrong
 * about that: an account cannot sponsor its own reserves, which Horizon
 * reports as `op_malformed` on the offending operation and nothing more
 * helpful. The operator is creating this balance out of its own pocket, which
 * is the intent anyway — offering a withdrawal costs the operator, never the
 * reader.
 *
 * A claimable balance is the whole non-custodial argument in one operation.
 * The DRV leaves the distributor immediately, and only the named claimant can
 * ever take it: not the operator, who cannot claw it back, and not anybody
 * else. There is no window in which the operator is holding a reader's asset.
 */
await submit(
  distributor,
  [
    Operation.createClaimableBalance({
      asset: DRV,
      amount: EARNED,
      claimants: [new Claimant(reader.publicKey(), Claimant.predicateUnconditional())],
    }),
  ],
  [distributor],
  `offer ${EARNED} DRV to the reader`,
);

const offered = await server.claimableBalances().claimant(reader.publicKey()).call();
const balanceId = offered.records[0].id;
console.log(`  claimable balance                    ${balanceId.slice(0, 20)}…`);

console.log("\n── 4 · the reader claims it, and pays nothing ──");
/*
 * The reader holds zero XLM, so they cannot pay a fee — and must not have to.
 * A fee-bump wraps their signed transaction inside one the operator pays for.
 * The inner signature is still the reader's and still the only thing that
 * authorises the claim; all the operator buys is the right to be charged.
 */
const readerAccount = await server.loadAccount(reader.publicKey());
const inner = new TransactionBuilder(readerAccount, { fee: BASE_FEE, networkPassphrase: NET })
  .addOperation(Operation.claimClaimableBalance({ balanceId }))
  .setTimeout(60)
  .build();
inner.sign(reader);

const bumped = TransactionBuilder.buildFeeBumpTransaction(
  distributor,
  String(Number(BASE_FEE) * 4),
  inner,
  NET,
);
bumped.sign(distributor);
const claimed = await server.submitTransaction(bumped);
console.log(`  ${"reader claims, operator pays".padEnd(36)} ${claimed.hash.slice(0, 16)}…`);

console.log("\n── what the network says afterwards ──");
const [r, d, i] = await Promise.all([
  server.loadAccount(reader.publicKey()),
  server.loadAccount(distributor.publicKey()),
  server.loadAccount(issuer.publicKey()),
]);
const amount = (acct, code) =>
  acct.balances.find((b) => (code === "XLM" ? b.asset_type === "native" : b.asset_code === code))?.balance ?? "—";

console.log(`  reader        ${String(amount(r, "DRV")).padStart(16)} DRV`);
console.log(`  reader        ${String(amount(r, "XLM")).padStart(16)} XLM   ← never held gas`);
console.log(`  distributor   ${String(amount(d, "DRV")).padStart(16)} DRV`);
console.log(`  distributor   ${String(amount(d, "XLM")).padStart(16)} XLM`);
console.log(`  fees, 6 tx    ${(10_000 - Number(amount(d, "XLM"))).toFixed(7).padStart(16)} XLM`);
console.log(`  reserves held ${String((d.num_sponsoring * 0.5).toFixed(1)).padStart(16)} XLM   (locked, recoverable)`);

const locked = i.signers.every((s) => s.weight === 0);
console.log(`  issuer        ${locked ? "cannot ever sign again ✓" : "STILL ABLE TO MINT ✗"}`);

console.log("\n── check it yourself ──");
for (const [name, kp] of [["reader", reader], ["distributor", distributor], ["issuer", issuer]]) {
  console.log(`  ${name.padEnd(12)} https://stellar.expert/explorer/testnet/account/${kp.publicKey()}`);
}

/*
 * Non-zero exit if the two properties this exists to prove did not hold. A
 * script that reports success by printing nice numbers and returning zero
 * regardless is a script that will one day report success about a broken
 * system.
 */
if (Number(amount(r, "DRV")) !== Number(EARNED) || Number(amount(r, "XLM")) !== 0 || !locked) {
  console.error("\n✗ the flow did not hold");
  process.exit(1);
}
console.log("\n✓ reader holds the asset, never held gas, and the supply is sealed");
