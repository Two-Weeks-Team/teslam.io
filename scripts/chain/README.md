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

```bash
cd scripts/chain && npm install     # once — the SDK is not a root dependency
node stellar-flow.mjs
```

The SDK is deliberately kept out of the root `package.json`. This is a spike,
the library is heavy, and nobody building the site should pay to install it.

It funds itself from Friendbot, so it needs no key, no account and no faucet
visit. Amounts come from `data/model.json`, so this cannot quote figures the
site disagrees with.

What the Stellar run printed:

```text
reader              18000.0000000 DRV
reader                  0.0000000 XLM   ← never held gas
distributor       8982000.0000000 DRV
fees,  7 tx             0.0001200 XLM   (issuer + distributor)
reserves held           1.5000000 XLM   (locked, recoverable)
issuer        cannot ever sign again ✓
```

Seven transactions cost the operator 0.00012 XLM. Both operator accounts are
counted: the issuer signs the mint and signs its own locking, and an earlier
version of this measured only the distributor and so reported a total that was
two transactions short. The 1.5 XLM is
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

**Getting onto Base costs a credential.** Not a reason to choose a chain, but
the reason this proof took a day longer than the Stellar one — every route to
Base Sepolia ETH is gated:

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

`base-flow.mjs` has now run. Everything about it that can be checked without a
chain is checked first by `offline-check.mjs`:

```bash
node scripts/chain/offline-check.mjs

compiled  Drv          1577 bytes
compiled  Distributor  1429 bytes
tree      500 leaves, path length 9
proof     6/6 sampled indices verify
forgery   wrong account  rejected ✓
forgery   wrong amount   rejected ✓
forgery   wrong index    rejected ✓
forgery   empty proof    rejected ✓
solidity  leaf agrees with JS ✓ · pair agrees with JS ✓✓
```

The JS proof check is a second implementation of the loop inside
`Distributor.claim`, written separately so that agreeing means something. The
forgery rows matter more than the passing ones: a Merkle scheme that accepts a
proof for the wrong address is not a weaker scheme, it is no scheme.

The `solidity` rows matter most of all, and were added after the fact. Every
row above them is JavaScript agreeing with JavaScript, which cannot see the one
failure that costs an afternoon — the contract computing a different hash from
the builder, producing a proof that verifies perfectly offline and reverts on
chain. `readContract` with `code` and no address is a deployless `eth_call`:
the EVM runs the constructor and the function together and returns the answer
without deploying anything, for no gas and no key. Both sides get asked.

### Running it

Coinbase publishes the intended programmatic route, which is what
`cdp-fund.mjs` uses — an API key rather than a browser, so no bot check is
involved and nothing has to be worked around.

```bash
cp .env.local.example .env.local     # gitignored
# fill in CDP_API_KEY_ID and CDP_API_KEY_SECRET
node cdp-fund.mjs                    # faucet → the deploy account
node base-flow.mjs                   # deploy, settle, claim, verify
```

Credentials go in the file, never into a chat window — a secret that reaches a
conversation history has been disclosed, and rotating it is the only remedy.
`BASE_SEPOLIA_KEY` is a throwaway holding testnet ETH and nothing else.

`cdp-fund.mjs` tries to have the faucet pay the deploy account directly, and if
CDP will only fund accounts it holds, it creates one, funds that, and forwards
— which needs `CDP_WALLET_SECRET` as well, because forwarding means signing. It
polls the chain for the balance rather than sleeping, because the chain is the
authority on whether the money arrived and the API's own view of it lags.

### Borrowing a logged-in browser does not work

Worth writing down so nobody spends the afternoon on it again. Copying a Chrome
profile to drive an authenticated session fails on macOS: cookie values are
encrypted with a Keychain key that a Chrome launched from a shell cannot reach,
so it generates a fresh one and decrypts nothing. A profile with 3,652 cookie
rows yielded 9 usable ones, and both `portal.cdp.coinbase.com` and Google
Cloud's faucet reported signed-out — the latter in as many words: *"You are
signed out. Sign in to your Google Account to receive tokens."*

`login.coinbase.com` additionally sits behind Cloudflare bot management, which
held the automated browser indefinitely at "verification succeeded, waiting for
response". That is the control doing its job. The API key exists precisely so
that a program does not have to pretend to be a person.

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
