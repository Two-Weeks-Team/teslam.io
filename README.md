# teslam.io

A community for Tesla owners in Korea, where distance driven accrues as DRV.
Korean at `/`, English at `/en`. The operating model behind the rewards lives
at `/model`.

**This is an independent community project. It is not affiliated with, endorsed
by, or connected to Tesla, Inc.** Tesla and Supercharger are trademarks of
Tesla, Inc. No token has been issued; nothing here is an offer or investment
advice.

## The front page is a board, not a document

The first version of this site led with a cost ledger, a break-even figure and
two disclaimers. That is the right artefact for a partner and the wrong one for
an owner, who comes for rank, identity and something to brag about.

So the front page is now the community: a live ticker, the Genesis 500 cohort
drawn as its 500 seats, the weekly efficiency league, the board itself, and a
DRV wallet in the right rail. Ten alternative directions were built and
compared under `/alt` before settling on this combination — leaderboard for
return visits, board for substance, wallet for conversion.

**The board content is sample data.** `data/community.json` invents every post,
rank and balance so the layout can be judged populated. The page says so in a
notice at the top, and `tests/no-slop.test.ts` fails the build if that notice
is missing or empty while `isPreview` is set.

## `/model` — what the rewards actually cost

The operating brief this was built from frames the Tesla Fleet API bill as the
constraint on the business: about ₩1,000 per vehicle per month, ₩500,000 a month
for a 500-car cohort. That arithmetic is correct, and the page reproduces it.

It is also not the binding constraint. Carried one step further — using the same
brief's own reward rules — the API is roughly a third of what carrying a vehicle
actually costs, and the reward is the rest:

| per vehicle · month | |
| --- | ---: |
| Tesla Fleet API | ₩1,001 |
| DRV issued, face value | ₩6,000 |
| …of which burned in-app (no cost of service) | −₩2,100 |
| …of which staked, deferred | −₩1,500 |
| …of which redeemed for goods | ₩2,400 |
| …less assumed partner commission | −₩360 |
| **Cash out per vehicle** | **₩3,041** |

Genesis 500 is the same correction at cohort scale: ₩500,400 a month counting
API fees alone, about **₩2,030,400** once the 1.5× rewards it pays are included.

The page shows both numbers next to each other rather than the flattering one
alone. That is the whole editorial position.

## Every figure is derived, none are typed

`data/model.json` holds **inputs only**, split into `given` (the operator's
specification) and `assumed` (not yet validated against a real fleet). Every
figure rendered anywhere — HTML, the Markdown mirrors, `/llms.txt` — is computed
from those inputs by `lib/economics.ts` at build time.

No number is written into a content module or a component, and
`tests/no-slop.test.ts` fails the build if one appears. A figure on the page
therefore cannot drift from the model behind it.

Assumed inputs are tagged in the UI, and `data/model.json` must carry a `basis`
note for each one — `tests/economics.test.ts` enforces that too.

## Stack

Next.js 16 (App Router, every route static) · React 19 · Tailwind CSS 4 ·
TypeScript · deployed on Vercel, `icn1`.

There is no `app/layout.tsx`. Each locale is its own root layout under
`app/(ko)` and `app/(en)`, so `<html lang>` is correct without middleware
negotiating locale on every request.

## The `/model` hero

An instrument cluster: a route drawing itself across a map grid while four
signals and a DRV balance tick against it.

- `lib/drive/route.ts` — the route, generated deterministically from a fixed
  seed and shared by both renderers, so the server's SVG and the browser's
  animation are the same geometry with nothing to reconcile.
- `lib/drive/readout.ts` — pure `t → readings`. The odometer is monotonic by
  construction, for the same reason it is monotonic in the real verifier.
- `components/hero/cluster.tsx` — server-renders a *completed* drive, so the
  panel is a finished picture without JavaScript. Once mounted it writes
  straight to the DOM rather than through state; six readouts at 60fps should
  not re-render a React subtree sixty times a second.

It stops when scrolled out of view or the tab is hidden, and never starts under
`prefers-reduced-motion`.

## Typography

Two latin webfaces (Archivo, IBM Plex Mono) and **no Korean webfont**. A
subsetted Korean face is still hundreds of kilobytes and this page is mostly
figures; Korean falls to Pretendard where installed, then the platform face.

`word-break: keep-all` is set globally. Korean breaks anywhere by default,
splitting words across lines — the clearest sign a Korean page was laid out by
someone who does not read it.

## Commands

```bash
pnpm dev        # http://localhost:3000
pnpm verify     # lint · typecheck · build · test
pnpm build && pnpm start
```

`pnpm build` runs before `pnpm test` deliberately: `tests/ssr.test.ts` reads the
built HTML to prove each headline figure is server-rendered rather than
hydrated in.

## Machine-readable

- `/llms.txt`
- `/model.md`, `/en/model.md` — the operating model, rendered from the same
  content modules and derivations as the HTML, so the two cannot disagree.
  The front page has no Markdown mirror on purpose: its content is sample data.
- `/model.json` — the raw inputs, so the arithmetic is checkable rather than
  merely asserted

## Not built yet

The Genesis 500 button points at an external form. This site is fully static and
stores no personal data — there is no database here to secure and no account
system. The Fleet API integration, the verifier and the settlement pipeline
described on the page are a design, not a deployment.

## The ten directions

`/alt` is a gallery of the ten landing-page directions this design was chosen
from — leaderboard, garage, live map, community feed, quest board, cinematic,
retro cluster, magazine, wallet, cult. Each is one self-contained file in
`public/` with no external request and every visual drawn in CSS or SVG.

They are drafts: `robots.ts` disallows `/alt*` so half-finished pages do not get
indexed under this brand. Delete them once the direction is settled.

## Sample content and the demo, in one switch

`NEXT_PUBLIC_SHOWCASE=off` removes every invented figure from the site — sample
posts, the leaderboard, quests, badges, the wallet, the nameplate, the ticker,
and the rehearsed Genesis playback — in one setting. Unset or anything else
leaves them in place, labelled.

What the switch does **not** decide is which sections are real. The API answers
that at `/v1/capabilities`, and the site renders from it:

| API has the source | `SHOWCASE` | The section draws |
|---|---|---|
| yes | either | real data |
| no  | on  | sample content, marked |
| no  | off | nothing |

So shipping a backend is what promotes a section. Flip its line in
`capabilities()` in `cloudflare/worker.ts` and the site follows without being
rebuilt — and a section cannot go on calling itself sample content once it has
stopped being any such thing.

Set it per environment in Vercel, or locally:

```bash
NEXT_PUBLIC_SHOWCASE=off pnpm dev
```

## The board

Real posts, comments and votes, in D1 (`cloudflare/migrations/0002_board.sql`).

Identity is a Genesis seat: confirming the registration mail creates the account
and issues the session, and nothing else does. There is no login form. Reading
needs no account; writing, replying and voting need a confirmed seat.

Signing in sets one HttpOnly cookie (`tsl_session`, 30 days, deleted on sign-out
and swept by the daily cron). Browsing sets nothing — `/privacy` §9 says so and
`tests/privacy-claims.test.ts` holds it to that.

Walk the whole flow locally without sending any mail:

```bash
pnpm cf:dev                                    # worker + local D1
NEXT_PUBLIC_API_ORIGIN=http://localhost:8787 pnpm dev

# mint a confirmation link instead of mailing it
curl -X POST localhost:8787/v1/genesis/invite \
  -H "authorization: Bearer $EXPORT_TOKEN" -H 'content-type: application/json' \
  -d '{"email":"you@example.com","model":"Model 3","trim":"Long Range",
       "region":"capital","kmBand":"1000_2000","consentTerms":true,"consentPrivacy":true}'
```

Then open the API leg of that link (`/v1/genesis/confirm?token=…`) to take the
seat and receive the session.

## The car on the Genesis panel

The body is a downloaded glTF, converted at build time into a small binary the
renderer uploads directly. The source is **not** in this repository — it is tens
of megabytes of somebody else's mesh and textures, and `/assets` is gitignored.

```bash
# 1. Download a Model 3 under a licence that allows reuse. CC BY works;
#    check the licence on the model page, not on the site's front page.
#    Save it as assets/model3.glb  (glTF Binary)

# 2. Convert. Writes public/car/model3.bin, which IS committed.
node scripts/build-car.mjs assets/model3.glb

# 3. Fill in lib/car-credit.ts with the author and the licence.
#    Attribution is the condition of CC BY, not a courtesy, and
#    tests/car-credit.test.ts fails the build while it is still a placeholder.
```

The converter is dependency-free — glTF 2.0 is a JSON header and a binary blob —
and it does three things a straight export would not: welds and decimates to a
triangle budget, classifies materials into paint, glass, rubber and alloy so the
shader can tell them apart, and normalises the pose to the frame the camera and
the shadow already expect (two units long, nose at +x, sitting on y = 0).

If `public/car/model3.bin` is absent the page draws the generated body instead,
which is the fallback and not a bug: the file is fetched only when the panel
scrolls into view, and a reader whose network drops it still gets a car.

**On the licence.** A CC BY grant covers the uploader's own work in the mesh. It
is not a licence to Tesla's design rights in the vehicle — nobody but Tesla can
give that. teslam.io draws the car this community drives, is not affiliated with
Tesla, Inc., and says so on every page.
