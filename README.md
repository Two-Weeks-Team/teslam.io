# teslam.io

A drive-to-earn proposal for Tesla owners in Korea, as a single page. Korean at
`/`, English at `/en`.

**This is an independent community project. It is not affiliated with, endorsed
by, or connected to Tesla, Inc.** Tesla and Supercharger are trademarks of
Tesla, Inc. No token has been issued; nothing here is an offer or investment
advice.

## What the page argues

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

## The hero

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
- `/index.md`, `/en/index.md` — rendered from the same content modules and the
  same derivations as the HTML, so the two cannot disagree
- `/model.json` — the raw inputs, so the arithmetic is checkable rather than
  merely asserted

## Not built yet

The Genesis 500 button points at an external form. This site is fully static and
stores no personal data — there is no database here to secure and no account
system. The Fleet API integration, the verifier and the settlement pipeline
described on the page are a design, not a deployment.
