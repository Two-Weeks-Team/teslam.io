#!/usr/bin/env bash
#
# Prove a car would trust this server.
#
# Tesla's setup guide calls for `check_server_cert.sh` at step 8, and it is the
# only check here that means anything: everything else confirms our own
# software is running, while this one confirms the thing we do not control —
# that a vehicle's TLS stack will accept this host, this certificate and this
# chain. A receiver that is up and untrusted is a receiver nothing will ever
# connect to, and it looks perfectly healthy from the inside.
#
#     ./verify.sh
#
# Read-only. Downloads Tesla's script to a temporary directory and deletes it.

set -euo pipefail

HOST="${FT_HOST:-telemetry.teslam.io}"
PORT="${FT_PORT:-4443}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

say() { printf '  %-30s %s\n' "$1" "$2"; }
fail() { printf '\n✗ %s\n' "$1"; exit 1; }

echo "── the container ──"
if ! docker compose -f "$HERE/docker-compose.yml" ps --status running --quiet fleet-telemetry | grep -q .; then
  fail "fleet-telemetry is not running — docker compose up -d"
fi
say "container" "running"

echo
echo "── the port ──"
# Ask from outside rather than from inside: a service bound to the wrong
# interface answers happily on localhost and is unreachable to a car.
if ! timeout 8 bash -c ">/dev/tcp/$HOST/$PORT" 2>/dev/null; then
  fail "$HOST:$PORT does not accept connections — check DNS, the firewall, and that the Cloudflare proxy is off"
fi
say "$HOST:$PORT" "accepting connections"

echo
echo "── the certificate ──"
CHAIN="$(mktemp)"
trap 'rm -f "$CHAIN"' EXIT
#
# `openssl s_client` exits non-zero here even when everything is right, and the
# first version of this script read that as failure.
#
# A Fleet Telemetry server does mTLS. Connecting without a client certificate
# gets the server's certificate, completes verification, and is then refused
# with `tlsv13 alert certificate required` — which is the server working
# exactly as it must. Treating a non-zero exit as "no handshake" reported a
# correctly configured receiver as broken.
#
# So the exit code is ignored and the output is read instead. What matters is
# whether a certificate came back and whether the chain verified.
echo | openssl s_client -connect "$HOST:$PORT" -servername "$HOST" -showcerts >"$CHAIN" 2>&1 || true
if ! grep -q "BEGIN CERTIFICATE" "$CHAIN"; then
  fail "no certificate offered at $HOST:$PORT — is anything listening?"
fi
VERIFY="$(grep -o 'Verify return code: .*' "$CHAIN" | head -1)"
SUBJECT="$(openssl x509 -in "$CHAIN" -noout -subject 2>/dev/null | sed 's/^subject=//')"
ISSUER="$(openssl x509 -in "$CHAIN" -noout -issuer 2>/dev/null | sed 's/^issuer=//')"
EXPIRY="$(openssl x509 -in "$CHAIN" -noout -enddate 2>/dev/null | cut -d= -f2)"
say "subject" "$SUBJECT"
say "issuer" "$ISSUER"
say "expires" "$EXPIRY"
say "chain" "${VERIFY:-not reported}"

# The one line that decides whether a car gets this far.
case "$VERIFY" in
  *"code: 0 (ok)"*) ;;
  *) fail "the chain did not verify — $VERIFY" ;;
esac

# And the refusal that proves the server is doing mTLS rather than serving
# anyone who asks. Its absence would be the real problem.
if grep -q "certificate required" "$CHAIN"; then
  say "mTLS" "enforced — refused us for having no client certificate"
else
  say "mTLS" "NOT enforced — the server accepted a connection with no client certificate"
fi

# Self-signed is the failure that looks like success in every other check: the
# server is up, the port answers, the handshake completes — and no car will
# ever finish one.
if [ "$SUBJECT" = "$ISSUER" ]; then
  fail "self-signed certificate. Vehicles verify against public roots; this needs a real CA."
fi
say "self-signed" "no"

echo
echo "── Tesla's own check ──"
TOOLS="$(mktemp -d)"
trap 'rm -rf "$TOOLS" "$CHAIN"' EXIT
if ! curl -fsSL -o "$TOOLS/check_server_cert.sh" \
  "https://raw.githubusercontent.com/teslamotors/fleet-telemetry/main/tools/check_server_cert.sh"; then
  fail "could not fetch check_server_cert.sh"
fi
chmod +x "$TOOLS/check_server_cert.sh"

# The `ca` field wants the full chain used to issue the server certificate.
CA_FILE="$HERE/tls/fullchain.pem"
[ -f "$CA_FILE" ] || fail "no $CA_FILE — the chain has to be readable to be declared"
python3 - "$TOOLS/validate_server.json" "$HOST" "$PORT" "$CA_FILE" <<'PY'
import json, sys
out, host, port, ca = sys.argv[1:5]
json.dump({"hostname": host, "port": int(port), "ca": open(ca).read()}, open(out, "w"), indent=2)
PY

if "$TOOLS/check_server_cert.sh" "$TOOLS/validate_server.json"; then
  say "certificate" "Tesla's own check passes"
else
  fail "check_server_cert.sh rejected the configuration"
fi

echo
echo "── the consumer ──"
#
# The receiver is only half the pipe, and the other half fails in a way nothing
# else here would notice.
#
# Fleet Telemetry publishes to Redis pub/sub. A publish with no subscriber
# succeeds and the record is gone — and `reliable_ack: true` means the car was
# already told it was delivered. A consumer that is running but not subscribed
# therefore looks perfectly healthy from every angle except this one, while
# every signal a member's car sends is discarded.
#
# So "is the container up" is not the question. "Is it subscribed" is.
HEALTH="${FT_HEALTH:-http://127.0.0.1:9274/healthz}"
if ! docker compose -f "$HERE/docker-compose.yml" ps --status running --quiet consumer | grep -q .; then
  fail "the consumer is not running — records published now are lost, not queued"
fi
say "container" "running"

BODY="$(curl -fsS --max-time 8 "$HEALTH" 2>/dev/null || true)"
[ -n "$BODY" ] || fail "no answer from $HEALTH — is the health port bound?"

read_field() { printf '%s' "$BODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('$1'))"; }

[ "$(read_field ok)" = "True" ] || fail "consumer reports not ok: $BODY"
say "subscribed" "$(read_field subscribed)"
say "received" "$(read_field receivedTotal)"
say "sent" "$(read_field sentTotal)"
say "dropped" "$(read_field droppedTotal)"
say "pending" "$(read_field pending)"

# Dropped records are the number worth an alert. Everything else here can be
# zero for an innocent reason — no car is connected yet — but a record that
# arrived and did not reach D1 is distance somebody drove and was not paid for.
if [ "$(read_field droppedTotal)" != "0" ]; then
  fail "the consumer has dropped $(read_field droppedTotal) records — check its logs"
fi

echo
echo "✓ a vehicle would trust $HOST:$PORT, and what it sends would be kept"
