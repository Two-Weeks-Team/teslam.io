# Fleet Telemetry receiver

Vehicles connect **inward** to this service and stream signals to it. Tesla's
documentation is explicit that *"mTLS connections are terminated on the Fleet
Telemetry service"*, and that one line decides the shape of everything here.

It means the receiver **cannot sit behind a reverse proxy**. The 193 server
already runs nginx on 443 for eleven domains; a proxy terminating TLS is
precisely what must not happen, so the receiver takes its own port and its own
certificate and leaves nginx alone.

It also means this is the only part of teslam.io that has to be a long-lived
host. Everything else stays serverless: the receiver publishes signals to Redis
and a consumer forwards them to D1. Both run here, in the same compose project.

| | |
| --- | --- |
| Host | `49.247.9.193` |
| FQDN | `telemetry.teslam.io` |
| Port | `4443` — 443 belongs to nginx |
| Image | `tesla/fleet-telemetry:v0.9.4` |
| Dispatcher | Redis, its own instance |

## Why its own Redis

Five Redis instances already run on that box and they belong to other projects.
A telemetry backlog filling somebody else's instance is the kind of coupling
that is only ever discovered during an incident.

## Prerequisites, in order

Steps 1–6 are Tesla-account work and none of them can be done from here. The
receiver can be stood up and proved correct without them — that is what
`verify.sh` is for — but no vehicle will stream until they are complete.

1. Developer application at [developer.tesla.com](https://developer.tesla.com),
   with `teslam.io` in `allowed_origins`.
2. `openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem`
3. `openssl ec -in private-key.pem -pubout -out public-key.pem`
4. Publish it at `https://teslam.io/.well-known/appspecific/com.tesla.3p.public-key.pem`.
   It must **stay** there: if it disappears, Fleet API starts answering that
   the application is not registered.
5. Partner authentication token.
6. `POST /api/1/partner_accounts` — once per region the users are in.

## Standing it up

**DNS first.** `telemetry.teslam.io` → `49.247.9.193`, and the Cloudflare proxy
must be **off** (grey cloud). Two reasons, either sufficient: Cloudflare does
not proxy 4443, and an orange-clouded record would terminate TLS at Cloudflare,
which is the thing the whole design forbids.

**Then the certificate.** A publicly trusted one — vehicles verify it, so a
self-signed or Cloudflare Origin certificate will not do. DNS-01 avoids
touching nginx:

```bash
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/cloudflare.ini \
  -d telemetry.teslam.io
```

Then place `fullchain.pem` and `privkey.pem` in `./tls/`, and give the key to
the user the container runs as:

```bash
sudo chown 65532:65532 tls/privkey.pem   # distroless nonroot
chmod 600 tls/privkey.pem
```

The image is distroless and runs as UID 65532. Widening the mode to 0644 would
also work and would mean every account on the host can read the private key —
a poor trade for saving one `chown`.

**Then the service.**

```bash
docker compose up -d
docker compose logs -f fleet-telemetry
```

**Then prove it.** `verify.sh` runs Tesla's own `check_server_cert.sh` against
the running server. It is the same check Tesla's setup guide calls for at step
8, and passing it is what "a car will trust this host" actually means.

```bash
./verify.sh
```

## What the smoke test found

Run against the real image on 193 with a throwaway certificate, bound to
localhost so nothing was exposed before DNS and a real certificate existed.
Three things failed, all of them config rather than code, and all three would
have been far more expensive to find later.

**The image already has the right `Cmd`.** Overriding `command:` with just the
flags replaces the whole of it, and Docker then treats `-config` as the
executable — `executable file not found in $PATH`, which reads like a missing
binary rather than a mangled argv. There is no `command:` here now.

**The Redis dispatcher refuses to start without `publish_vin_topics` or
`subscriber_set_prefix`.** It panics rather than accepting every record and
publishing none, which is the right choice: the alternative is a queue that
stays empty for three weeks while everything reports healthy.

**The image is distroless and runs as UID 65532**, so a `0600` private key owned
by the deploying user is unreadable to it. `chown 65532:65532` rather than
widening the mode.

After those, the server started, registered Redis, and terminated TLS on 4443
with the certificate presented as `CN=telemetry.teslam.io`.

## Live

| | |
| --- | --- |
| `telemetry.teslam.io` | A → `49.247.9.193`, DNS only |
| Certificate | Let's Encrypt, expires 2026-11-15 |
| Renewal | `ops/certbot-deploy-hook.sh`, dry-run passes |
| Tesla's check | `The server certificate is valid.` |

Two things the deployment had to get right on a box running fifteen containers
and eleven other people's domains.

**The certificate is obtained without touching any existing nginx config.**
`ops/nginx-acme.conf` is a new file serving nothing but the ACME challenge path
for this one hostname; the eleven live vhosts were not edited. It sorts after
`api.*` in `sites-enabled`, so it does not become the implicit default server.
Two domains on that host return 502 — `api.fairthon.com` and `kbeauty.market`,
whose upstreams on 2618 and 10004 are down. Checked rather than assumed: the
receiver's block names only `telemetry.teslam.io`, and those ports were already
refusing connections.

**A renewal that does not reach the container is a silent expiry.** The deploy
hook copies the new pair in, fixes ownership for UID 65532 and restarts. Without
it the certificate lapses in ninety days, vehicles stop connecting, and the
container goes on reporting itself healthy — which is exactly what it would be,
from the inside.

## `verify.sh` read a success as a failure

Worth recording, because the mistake is a good one. `openssl s_client` exits
non-zero against a correctly configured Fleet Telemetry server: it receives the
certificate, verifies the chain, and is then refused with `tlsv13 alert
certificate required` — because the server does mTLS and we brought no client
certificate. The first version treated that exit code as "no TLS handshake" and
reported a working receiver as broken.

The script now ignores the exit code and reads the output. `Verify return code:
0 (ok)` is the line that decides whether a car gets this far, and the refusal is
checked *for* rather than against — a server that accepted us would be the real
problem.

## Operational notes worth knowing before an incident

**Exceeding the Fleet API billing limit removes every vehicle's telemetry
configuration and does not restore it.** At five hundred seats that is five
hundred configurations to push again. Set a billing limit deliberately and
watch the 80% warning email.

**A vehicle streams to at most five third-party applications at once.** Owners
who already use other Tesla apps may be at that limit.

**Firmware 2024.26 or later**, and 2025.20+ for Model S/X with Intel Atom.

**Signals are sent only when both conditions hold** — the configured interval
has elapsed *and* the value changed. This is what makes "a parked car sends
nothing" true rather than aspirational, and it is why the cost model works out
at streaming rates rather than polling rates.

## The consumer

`services/telemetry-consumer/` forwards records from Redis to
`api.teslam.io/v1/telemetry/ingest`, which parses them and writes the ledger. It
runs as a third container in this same project.

### Redis pub/sub is not a queue

This README used to say the receiver "fills a queue". It does not, and the
difference decides how the consumer has to be operated.

`datastore/redis/redis.go` calls `client.Publish`. A publish with no subscriber
**succeeds**, returns zero, and the record is gone — there is no backlog to
catch up from. `reliable_ack: true` makes it worse in one specific way: the
receiver acks the vehicle as soon as the publish returns, so the car believes
the record was delivered and will never send it again.

**Anything published while the consumer is not subscribed is lost permanently.**

It is survivable, but because of the ledger rather than the transport. Accrual
measures the difference between two readings, so a missed frame is absorbed by
the next one's delta and costs nobody anything. Two exceptions:

- a gap beyond seven days is refused as `gap-too-long` and that distance is
  never credited;
- a missed **coordinate** is simply gone. A position has no delta to hide in.

So restarts must be short and rare, and `docker compose down` for longer than a
moment is a decision about data, not a maintenance step.

### Deploying it

The build context has to sit inside the compose project directory, and the
repository is not checked out on 193:

```bash
rsync -a --delete services/telemetry-consumer/ \
  49.247.9.193:~/teslam-fleet-telemetry/consumer/
```

Then, on the host, an `.env` beside `docker-compose.yml`:

```bash
INGEST_URL=https://api.teslam.io/v1/telemetry/ingest
TELEMETRY_TOKEN=…      # the value given to `wrangler secret put TELEMETRY_TOKEN`
```

```bash
docker compose up -d --build consumer
curl -s localhost:9274/healthz | jq
```

`ok` is true only when the process is both connected and subscribed. That is the
state worth alerting on: a consumer that is running but unsubscribed looks
perfectly healthy from the outside and is discarding every record a car sends.

### What it deliberately does not do

It never parses a record. Bytes arrive from Redis and leave for the Worker
unchanged, because everything that understands the format — miles, the odometer,
the daily cap, coordinates — lives in `cloudflare/lib/` under vitest, against
the same D1 the ledger uses. A second implementation on a shared host would be
one nobody tests.

It never logs a payload, only counts. A record carries a VIN and, once
collection is switched on, a coordinate; a log file on a box shared with eleven
other domains has none of the retention the database has.

## What this does not do yet

**No vehicle is connected.** The pipe is complete from a car's TLS handshake to
a row in `drv_ledger`, and nothing is streaming into it, because a vehicle can
only be configured by an application registered at developer.tesla.com. See
`docs/tesla-app-registration.md` — steps 1–6 above are that work.
