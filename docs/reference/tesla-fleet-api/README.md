# Tesla Fleet API — captured reference

Tesla's own documentation, captured verbatim on **2026-08-15**.

It is here because `developer.tesla.com` returns **403 to plain HTTP fetchers**,
so neither an agent nor a CI job can read it on demand. A real browser renders
it fine, which is how these were taken — see `capture.mjs`.

**Do not edit the bodies.** If a page here is wrong, the fix is to re-capture
it, not to correct it by hand. A reference that someone has quietly improved is
worse than no reference, because it still looks authoritative.

## Why this exists at all

The site had two years of accumulated assumptions about this API, from work
done in September and October 2024 — three archived repositories, an OAuth app
that reached a real token, and a cost model built on a tariff quoted in a
whitepaper. Some of it survived contact with the current documentation and some
did not, and telling those apart needed the documentation in front of us rather
than remembered.

## What each page settles

| Page | Settles |
| --- | --- |
| [`docs-fleet-api`](docs-fleet-api.md) | Onboarding order, and the `openssl` command that generates the domain key |
| [`authentication-overview`](authentication-overview.md) | The complete scope list |
| [`authentication-third-party-tokens`](authentication-third-party-tokens.md) | The flow a vehicle owner goes through |
| [`authentication-partner-tokens`](authentication-partner-tokens.md) | The token an application uses to register itself |
| [`endpoints-partner-endpoints`](endpoints-partner-endpoints.md) | `register`, and what it requires first |
| [`endpoints-vehicle-endpoints`](endpoints-vehicle-endpoints.md) | `vehicle_data` and the rest of the polling surface |
| [`fleet-api-fleet-telemetry`](fleet-api-fleet-telemetry.md) | The streaming architecture |
| [`fleet-telemetry-available-data`](fleet-telemetry-available-data.md) | **Every signal, its category, and its type** |
| [`fleet-api-billing-and-limits`](fleet-api-billing-and-limits.md) | Rates, rate limits, and what happens when a bill is exceeded |
| [`getting-started-best-practices`](getting-started-best-practices.md) | What Tesla asks applications not to do |
| [`virtual-keys-developer-guide`](virtual-keys-developer-guide.md) | Pairing a key to a vehicle |
| [`fleet-api-announcements`](fleet-api-announcements.md) | The changelog — where the two-year drift is visible |

## Four things worth reading before writing any code

**`Odometer` is `Vehicle State`, not `Location`.** It does not require the
`vehicle_location` scope. The privacy policy's claim that this site does not
collect coordinates therefore survives the Fleet API integration intact, and so
does staying outside 위치정보법. Accrual is decided by the odometer alone, so
nothing is lost by never asking for location.

**`vehicle_location` is a separate scope now.** It was folded into
`vehicle_device_data` until late 2024. Anything written against the older
behaviour assumes location arrives whether you want it or not; it does not.

**`Odometer` is reported in miles.** `data/model.json` accrues per kilometre.

**Streaming and polling are not the same price.** Tesla's own case study: 70
signals at 60s–10min intervals is ~1,000 signals/hour and **$0.00667 per
vehicle-hour**; the same data by polling `vehicle_data` is **$0.12** — eighteen
times more. That first figure works out at 1 ÷ 149,925 USD per signal, which is
`model.json`'s `signalsPerUsd: 150000` almost exactly. **The model is priced for
Fleet Telemetry.** Build it as polling and every published cost figure on the
site becomes wrong by a factor of eighteen.

One operational hazard from the same page: exceeding the billing limit
**removes Fleet Telemetry configurations and does not restore them**. At five
hundred seats that is five hundred configurations to push again.

## What was decided from reading this

**The receiver runs on the 193 server, in Docker.** Fleet Telemetry is vehicles
connecting outward to a host you operate, over TLS, with a CA they can check —
the docs are explicit that the server "must be running on a server exposed to
the public internet". This site is otherwise Vercel and Cloudflare Workers, and
neither can be that host. Tesla publishes the receiver as open source
(`teslamotors/fleet-telemetry`); it takes the signals and hands them on to D1,
so the serverless half of the architecture is unchanged and only the receiving
edge is new.

**Coordinates are not requested.** `Odometer` is `Vehicle State` and
`VehicleSpeed` is `Driving`; the four-signal list in `data/model.json` existed
because the older API delivered latitude and longitude whether you wanted them
or not. Asking for them today is a deliberate act and there is no reason to
perform one — the odometer alone decides accrual. The list is now two signals,
which halves the telemetry cost and lets the proof section say plainly that no
coordinate is ever received. That sentence was unavailable for a long time
because it was false.

**The whitepaper is now behind the code.** Halving the signals halves the
published API figures — ₩67 to ₩33 per vehicle-month, ₩33,360 to ₩16,680 for
the cohort. `data/whitepaper-params.json` carries a `documentStatus` block
recording exactly that, because the alternative was editing the numbers quietly
and leaving the PDF saying something else.

## Re-capturing

```bash
node docs/reference/tesla-fleet-api/capture.mjs
```

Needs a Chrome on the machine. It overwrites the pages and stamps today's date,
so the diff shows exactly what Tesla changed — which is the point of keeping
them in git rather than in a browser tab.
