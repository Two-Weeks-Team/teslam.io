# Chain spike

A question came up that a paragraph could not settle: if DRV and TSLM are ever
issued on a chain, what does the withdrawal actually look like, and what does
it cost the person collecting it?

Three properties were agreed before any chain was named.

**DRV accrues off-chain.** Nothing touches a chain while somebody is driving. A
reward that waits on block times is a reward that breaks when the chain does,
and the odometer reading that earns it is already the thing being trusted.

**Withdrawal is non-custodial.** The operator must never hold a reader's asset.
This is not fastidiousness — holding it is the act Korean law calls 보관·관리,
and it is what would turn a community board into a business that needs FIU
registration, ISMS certification and a bank's real-name account contract.

**The reader pays nothing.** No gas, no deposit, no minimum balance. Somebody
who drove to Gangneung should not have to go and acquire a second asset before
they can collect the first.

## What was run

`stellar-flow.mjs` does the whole thing against Stellar testnet and prints what
the network says afterwards rather than what it asked for.

```
cd scripts/chain && npm install     # once — the SDK is not a root dependency
node stellar-flow.mjs
```

The SDK is deliberately kept out of the root `package.json`. This is a spike,
the library is heavy, and nobody building the site should pay to install it.

It funds itself from Friendbot, so it needs no key, no account and no faucet
visit. Amounts come from `data/model.json`, so this cannot quote figures the
site disagrees with.

What it printed:

```
reader              18000.0000000 DRV
reader                  0.0000000 XLM   ← never held gas
distributor       8982000.0000000 DRV
fees, 6 tx              0.0001000 XLM
reserves held                 1.5 XLM   (locked, recoverable)
issuer        cannot ever sign again ✓
```

Six transactions cost the operator a ten-thousandth of an XLM. The 1.5 XLM is
not spent — it is the reader's account and trustline reserves, held on the
operator's balance sheet and released if the reader ever closes the trustline.
At 500 seats that is 750 XLM tied up, which is worth stating plainly and is
not a number that decides anything.

Four protocol operations, and no contract:

| Needed | On an EVM chain | Here |
| --- | --- | --- |
| Non-custodial claim | Merkle distributor contract | `createClaimableBalance` |
| Reader pays no gas | ERC-4337 paymaster | `feeBumpTransaction` |
| Reader pays no deposit | no equivalent | `sponsoredReserves` |
| Supply provably fixed | burn the mint role | lock the issuing account |

The last row is the one worth dwelling on. The site already tells readers the
supply is fixed and that nobody will print more, and until now that was a
sentence they had to take on trust — from a project whose entire argument is
that odometers beat promises. Setting the issuing account's master weight to
zero makes it a fact anybody can check.

## What this does not settle

**Stellar is not EVM.** The argument for Base was that the same Solidity would
move to Kaia later if domestic regulation made that matter. Choosing this gives
that up.

**Korean wallet support is thinner.** Freighter and Lobstr are not what a Tesla
owner in Bundang already has installed.

**Non-custodial removes the custody leg, not the issuance leg.** A transferable
asset is still being issued, and that question needs a lawyer rather than a
script.

**Base has not been proved the same way.** Not because it would not work — the
Merkle-plus-paymaster pattern is well trodden — but because every route to Base
Sepolia ETH is gated:

| Faucet | Result |
| --- | --- |
| Stellar Friendbot | 10,000 XLM, no gate |
| Coinbase CDP | `unauthorized - invalid key` — free key, needs a person |
| Chainlink | `Could not verify if you are human` |
| Kaia Kairos | reCAPTCHA |
| pk910 PoW | CAPTCHA required to start a session |
| Solana devnet | `requestAirdrop` refused on the public RPC |
| Polygon Amoy, Aptos | no response / HTTP 500 |

Those gates are the faucets working correctly, and defeating one to save five
minutes is not a trade worth making.

So `base-flow.mjs` is written and waiting on a funded key. Everything about it
that can be checked without a chain has been:

```
node scripts/chain/offline-check.mjs

compiled  Drv          1577 bytes
compiled  Distributor  1429 bytes
tree      500 leaves, root 0xc85a1a325dfc2344…
proof     6/6 sampled indices verify, path length 9
forgery   wrong account  rejected ✓
forgery   wrong amount   rejected ✓
forgery   wrong index    rejected ✓
forgery   empty proof    rejected ✓
```

The proof check there is a second implementation of the loop inside
`Distributor.claim`, written separately so that agreeing means something. The
forgery rows matter more than the passing ones: a Merkle scheme that accepts a
proof for the wrong address is not a weaker scheme, it is no scheme.

To run it, put a funded key in `.dev.vars` (gitignored):

```
BASE_SEPOLIA_KEY="0x…"
```

## What the EVM side needs that Stellar did not

Two contracts, written out in `contracts.sol` rather than imported from a
library — "we used OpenZeppelin" would hide exactly the thing this spike is
measuring.

Both properties come from what is **absent** rather than what is enforced.
`Drv` has no `mint`, no owner and no upgrade path, so the supply is fixed for
the same reason the Stellar issuer is locked: there is nothing that could
change its mind. `Distributor` has no function that returns tokens to the
operator, so the operator is not trusted to leave them alone — it is unable.

One thing the EVM side does better: `claim` credits `account` rather than
`msg.sender`, so the operator submits the transaction and pays for it while
being unable to redirect a single unit. The reader needs no ETH, no wallet
interaction and no transaction at all — which is a stronger version of "pays
nothing" than the Stellar flow, where the reader still had to sign. It also
means no ERC-4337 paymaster and no bundler, which is two fewer pieces of
infrastructure than the usual answer to this problem.

## Keys

`keys*.json` and `*-result.json` are gitignored. The keys hold play money on a
network that resets, so they are worthless by construction — but a private key
that reaches a working tree once will reach one again on the day it is not
worthless, so it never goes in.
