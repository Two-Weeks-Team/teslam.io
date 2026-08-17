# Registering the application with Tesla

Everything between a car and `drv_ledger` now exists and is tested. Nothing has
ever streamed through it, and nothing can until this is done, because a vehicle
will only connect to a Fleet Telemetry server named by an application Tesla has
registered.

This is the walkthrough. Every fact below is quoted from
`docs/reference/tesla-fleet-api/`, which is Tesla's own documentation captured
verbatim — `developer.tesla.com` returns 403 to HTTP fetchers, so the local copy
is the only version an agent or CI can read. Where Tesla's pages contradict each
other, both readings are given rather than one being picked quietly.

## Who does what

| | |
| --- | --- |
| Steps 1, 2, 6 | **You.** Account, browser, payment method, multi-factor |
| Steps 3, 4 | Prepared here. One command each |
| Steps 5, 7, 8 | Either — `curl`, once the values from step 1 exist |

Nothing in steps 3–8 needs a secret to pass through a conversation. The client
secret and the private key stay on your machine; commands below read them from
the environment.

---

## 1. Create the application

At [developer.tesla.com](https://developer.tesla.com). What matters later:

**`allowed_origins` must contain `teslam.io`.** The register call in step 5
sends a domain, and Tesla requires that *"the domain for this endpoint must
match the root domain from the `allowed_origins`"*.

**Scopes.** `openid`, `offline_access`, `vehicle_device_data`. `offline_access`
is what yields a refresh token — without it there is nothing to put in
`vehicles.refresh_token_enc` and every member would have to re-authorise every
eight hours.

`vehicle_location` is a **separate scope** and is not needed yet. Tesla's
announcement of 2024-11-26 split it out of `vehicle_device_data`, and from
January 2025 *"authorization grants without the `vehicle_location` scope will
lose access to location related functionality"*. `Odometer` is `Vehicle State`
and does not require it. Add it when the 위치정보법 filing is made and
`COLLECT_LOCATION` is switched on — not before, because the scope appears on the
consent screen and asking for a permission the service does not use is the
opposite of what `/privacy` promises.

**Note the client ID and client secret.** The secret is shown once.

## 2. Set a billing limit — before anything else works

> "By default, each account has a billing limit of 0."
> — `fleet-api-billing-and-limits.md`

An application at a limit of zero is a disabled application. Add a payment
method and raise the limit deliberately.

And the sentence to remember, because it is the expensive one:

> "If the billing limit is exceeded, API usage will be suspended and any
> vehicles configured for Fleet Telemetry will have their streaming
> configurations removed. ⚠️ **Fleet Telemetry configurations will not be
> restored.** ⚠️"

At five hundred seats that is five hundred configurations to push again, one
signed call at a time. Tesla emails at 80%. Treat that mail as an incident.

## 3. Generate the key pair

```bash
node scripts/tesla/keypair.mjs
```

EC on the secp256r1 (prime256v1) curve, which is what Fleet API requires. The
private key is written to `~/.secrets/teslam/private-key.pem` at mode 0600 and
the script refuses to write it anywhere inside the repository. The public half
is spliced into `lib/tesla.ts`.

**Back the private key up somewhere that is not this laptop.** Losing it means
rotating, and rotating means re-pairing every vehicle that already trusts it.

## 4. Publish the public key, and prove it

```bash
pnpm build && pnpm cf:check      # then deploy the site
curl -s https://teslam.io/.well-known/appspecific/com.tesla.3p.public-key.pem
```

Tesla's wording is that the key *"must be and remain hosted"* at that path. It
is served by `app/api/tesla-public-key/route.ts` through a rewrite, from a
constant in the repository rather than a file in `public/` — a dot-prefixed
directory is exactly the kind of thing a framework upgrade stops serving, and
the failure is not a 404 anybody notices. It is Fleet API answering that the
application is not registered, and cars declining to stream.

`tests/tesla-key.test.ts` asserts the rewrite exists, the content type is
`application/x-pem-file`, and that a private key can never be served.

## 5. Partner token, then register

Authentication endpoints are not billed.

```bash
export TESLA_CLIENT_ID=…
export TESLA_CLIENT_SECRET=…
export AUDIENCE=https://fleet-api.prd.na.vn.cloud.tesla.com

PARTNER_TOKEN=$(curl -s --request POST \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=client_credentials' \
  --data-urlencode "client_id=$TESLA_CLIENT_ID" \
  --data-urlencode "client_secret=$TESLA_CLIENT_SECRET" \
  --data-urlencode 'scope=openid vehicle_device_data' \
  --data-urlencode "audience=$AUDIENCE" \
  'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token' | jq -r .access_token)

curl -s --request POST "$AUDIENCE/api/1/partner_accounts" \
  --header "Authorization: Bearer $PARTNER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"domain":"teslam.io"}'
```

**Once per region of operation.** Tesla: *"the register call needs to be
completed in each region of operation."* The captured pages only ever show the
`na` base URL in examples and do not enumerate the regions, so confirm the right
`audience` for Korean accounts on the dashboard rather than guessing it here.

Then confirm Tesla sees the key that step 4 published:

```bash
curl -s "$AUDIENCE/api/1/partner_accounts/public_key?domain=teslam.io" \
  --header "Authorization: Bearer $PARTNER_TOKEN"
```

This is the only check that speaks for Tesla. The local test proves the file is
well-formed; this proves Tesla fetched it.

## 6. A member authorises, and pairs a virtual key

Two separate things, and the second is the one that gets forgotten.

**Authorise** — the ordinary OAuth leg, per member, with
`scope=openid offline_access vehicle_device_data`. Save the refresh token; it is
*single use* and *expires after 3 months*, so `vehicles.refresh_token_enc` has to
be rewritten on every use, not merely read.

**Pair the virtual key** — the owner adds the application's key to the car from
the Tesla mobile app. Until that happens, `fleet_telemetry_config create`
rejects the VIN with `missing_key`, and the rejection is per vehicle rather than
per account.

Set `show_keypair_step=true` on the authorize URL so the member is told there is
a second step before they are dropped into one.

## 7. Configure the vehicle to stream here

Through the vehicle-command proxy, which signs the configuration with the
private key from step 3:

> "This endpoint should be called through the Vehicle Command Proxy. The
> configured private key will be used to sign the configuration."

```jsonc
{
  "vins": ["…"],
  "config": {
    "hostname": "telemetry.teslam.io",
    "port": 4443,
    "ca": "<contents of the Let's Encrypt fullchain.pem>",
    "fields": {
      // What data/model.json asks for. 60s matches the interval the cost model
      // is built on, and `Odometer`'s own minimum delta is 0.1 mile from
      // firmware 2025.2.6 — so a parked car sends nothing at all.
      "Odometer": { "interval_seconds": 60 }
    }
  }
}
```

`ca` is the chain that issued the receiver's certificate — the same file
`deploy/fleet-telemetry/verify.sh` hands to Tesla's `check_server_cert.sh`,
which has already passed against this host.

Then watch, from this side:

```bash
ssh 49.247.9.193 'curl -s localhost:9274/healthz | jq'
```

`receivedTotal` moving is the first evidence a car has ever reached the server.

## 8. When a VIN is refused

```
GET /api/1/vehicles/{vin}/fleet_telemetry_config      # synced true/false
GET /api/1/vehicles/{vin}/fleet_telemetry_errors
GET /api/1/partner_accounts/fleet_telemetry_error_vins
```

`synced: false` means the car has the target config and has not adopted it yet —
it will on its next backend connection. That is normal for a sleeping car and is
not a failure.

Documented rejections: `missing_key` (step 6 not done), `unsupported_hardware`
(pre-2018 Model S/X, or pre-2021 on the JWS path), `unsupported_firmware`
(2024.26+, and 2025.20+ for Intel Atom Model S/X), `max_configs`.

## Tesla's own pages disagree about one limit

`endpoints-vehicle-endpoints.md` says a vehicle *"only allows 3 configurations
per vehicle for streaming via fleet telemetry"*, and the `max_configs` rejection
on the same page says *"vehicles that already have five configurations
present"*. Plan for three. An owner who already uses two other Tesla apps may
have no room, and that is a support answer worth writing before it is needed
rather than after.

## What is already true, and what this changes

| | Now | After |
| --- | --- | --- |
| `telemetry.teslam.io:4443` | up, mTLS, Tesla's check passes | unchanged |
| Consumer | subscribed, `receivedTotal: 0` | records arriving |
| `odometer_readings` | empty | filling |
| `.well-known` key | 404 | the key |
| A member's DRV | 0 | earned by driving |

## The one thing that is not on this page

Collecting coordinates. `COLLECT_LOCATION` stays `"false"` and the
`vehicle_location` scope is not requested until the 위치정보법 filing is made
and `/privacy` no longer tells readers that location is not received at any
stage. The path exists and is tested; the switch is deliberately separate from
the code that would use it.
