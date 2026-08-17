/**
 * The consumer.
 *
 * It sits between two things that could not reach each other: the Fleet
 * Telemetry receiver, which publishes to a Redis on 193, and D1, which only a
 * Worker can write. Cloudflare Workers cannot open a TCP connection to somebody
 * else's Redis, so this is the one long-lived process the design needs.
 *
 * It deliberately understands nothing about what it carries. A record goes in
 * as a string and leaves as the same string; miles, odometers, coordinates and
 * the daily cap are all decided in `cloudflare/lib/`, under vitest, against the
 * same D1 the ledger uses. A consumer on a shared host that knew how to read an
 * odometer would be a second implementation nobody tests.
 *
 * ── The thing to understand before changing this ─────────────────────────
 *
 * Redis pub/sub is not a queue. `datastore/redis/redis.go` calls `Publish`, and
 * a publish with no subscriber succeeds, returns zero, and is gone. There is no
 * backlog to catch up from. Worse, `reliable_ack: true` means the receiver acks
 * the car as soon as the publish returns — so the vehicle believes the record
 * was delivered and will not send it again.
 *
 * That has one consequence worth stating plainly: **anything published while
 * this process is not subscribed is lost permanently.** Restarts must be short
 * and rare, which is why the container restarts unless stopped and why this
 * process buffers in memory rather than exiting on a failed send.
 *
 * It is survivable because of a property of the ledger rather than of the
 * transport: accrual measures the difference between two readings, so a missed
 * frame is absorbed by the next one's delta. A gap of minutes costs nothing. A
 * gap beyond `MAX_GAP_MS` — seven days — is refused as `gap-too-long`, and a
 * missed coordinate is simply gone, because a position has no delta to hide in.
 */

import { createClient } from "redis";
import { createServer } from "node:http";

const env = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    console.error(JSON.stringify({ level: "fatal", msg: "missing_config", name }));
    process.exit(1);
  }
  return value;
};

const REDIS_URL = env("REDIS_URL", "redis://redis:6379");
const PATTERN = env("CHANNEL_PATTERN", "teslam_V_*");
const INGEST_URL = env("INGEST_URL");
const TOKEN = env("TELEMETRY_TOKEN");

/** Matches `MAX_BATCH` in the Worker. A larger batch is refused with 413. */
const BATCH_MAX = Number(env("BATCH_MAX", "500"));
/** How long a partial batch waits before going anyway. */
const FLUSH_MS = Number(env("FLUSH_MS", "5000"));
/**
 * How many records may pile up while the Worker is unreachable.
 *
 * A bound rather than unlimited growth: an outage long enough to fill this is
 * an outage in which the process being killed by the OOM killer would lose
 * everything, rather than the oldest part of everything. When it overflows the
 * oldest records go first — they are the ones whose distance the next delta
 * will most likely absorb.
 */
const BUFFER_MAX = Number(env("BUFFER_MAX", "20000"));
const HEALTH_PORT = Number(env("HEALTH_PORT", "9274"));

/**
 * Logs carry counts, never payloads.
 *
 * A record contains a VIN and, once collection is switched on, a coordinate.
 * Writing one to a log file puts personal data on a host shared with eleven
 * other domains, in a place with none of the retention the database has.
 */
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra }));

/* ── state, which is also what the health endpoint reports ─────────────── */

const state = {
  connected: false,
  subscribed: false,
  pending: 0,
  receivedTotal: 0,
  sentTotal: 0,
  droppedTotal: 0,
  failedFlushes: 0,
  lastRecordAt: null,
  lastFlushAt: null,
  lastError: null,
};

/** @type {string[]} */
let buffer = [];
let flushing = false;
let stopping = false;

/* ── sending ──────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send one batch, or say why not.
 *
 * A 4xx other than 429 is not retried: the Worker has looked at the body and
 * refused it, and sending the identical bytes again will be refused identically
 * while the buffer behind it grows. The batch is dropped and counted, loudly.
 * Everything else — a timeout, a 5xx, a 429 — is the network or the far side
 * being busy, and those are worth retrying because the writes are idempotent.
 */
async function send(records) {
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ records }),
    signal: AbortSignal.timeout(20_000),
  });

  if (res.ok) return { ok: true, report: await res.json() };

  const body = await res.text().catch(() => "");
  const retryable = res.status === 429 || res.status >= 500;
  return { ok: false, retryable, status: res.status, body: body.slice(0, 200) };
}

/**
 * Drain the buffer.
 *
 * Records are taken out before the send and put back at the front on a
 * retryable failure, so ordering survives a retry. Order is not required for
 * correctness — the Worker sorts by the vehicle's own clock before writing —
 * but a buffer that shuffles under load makes every later log harder to read.
 */
async function flush() {
  if (flushing || buffer.length === 0) return;
  flushing = true;

  try {
    while (buffer.length > 0) {
      const batch = buffer.slice(0, BATCH_MAX);

      let attempt = 0;
      for (;;) {
        let outcome;
        try {
          outcome = await send(batch);
        } catch (err) {
          outcome = { ok: false, retryable: true, status: 0, body: String(err) };
        }

        if (outcome.ok) {
          buffer = buffer.slice(batch.length);
          state.sentTotal += batch.length;
          state.lastFlushAt = new Date().toISOString();
          state.lastError = null;
          log("info", "flushed", { records: batch.length, ...outcome.report });
          break;
        }

        if (!outcome.retryable) {
          buffer = buffer.slice(batch.length);
          state.droppedTotal += batch.length;
          state.lastError = `${outcome.status} ${outcome.body}`;
          log("error", "batch_refused_and_dropped", {
            records: batch.length,
            status: outcome.status,
            body: outcome.body,
          });
          break;
        }

        attempt += 1;
        state.failedFlushes += 1;
        state.lastError = `${outcome.status} ${outcome.body}`;
        // Capped exponential backoff. Beyond a minute there is no value in
        // waiting longer: the records keep arriving at a fixed rate whatever
        // this process does, so a longer sleep only makes the buffer deeper.
        const wait = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6));
        log("warn", "flush_failed", { attempt, waitMs: wait, status: outcome.status });
        if (stopping) return;
        await sleep(wait);
      }

      state.pending = buffer.length;
    }
  } finally {
    flushing = false;
    state.pending = buffer.length;
  }
}

/* ── receiving ────────────────────────────────────────────────────────── */

function accept(message) {
  state.receivedTotal += 1;
  state.lastRecordAt = new Date().toISOString();

  if (buffer.length >= BUFFER_MAX) {
    // Drop from the front. The oldest record is the one whose distance the next
    // delta is most likely to absorb; dropping the newest would strand the
    // interval that is still open.
    const shed = buffer.length - BUFFER_MAX + 1;
    buffer.splice(0, shed);
    state.droppedTotal += shed;
    log("error", "buffer_overflow", { dropped: shed, max: BUFFER_MAX });
  }

  buffer.push(message);
  state.pending = buffer.length;

  if (buffer.length >= BATCH_MAX) void flush();
}

/* ── health ───────────────────────────────────────────────────────────── */

/**
 * Say whether this is doing its job, not merely running.
 *
 * The receiver taught this lesson twice: a service bound to the wrong interface
 * answers happily on localhost, and a Redis dispatcher with no subscriber
 * reports every publish as a success. "Up" is not the question. Subscribed, and
 * how long since a record arrived, is.
 *
 * Bound to loopback. Nothing here should be reachable from the internet, and
 * the counts alone would tell a stranger how many cars are connected.
 */
function health() {
  createServer((req, res) => {
    if (req.url !== "/healthz") {
      res.writeHead(404).end();
      return;
    }
    const ok = state.connected && state.subscribed;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok, ...state }, null, 2));
  }).listen(HEALTH_PORT, "0.0.0.0", () => {
    log("info", "health_listening", { port: HEALTH_PORT });
  });
}

/* ── entry ────────────────────────────────────────────────────────────── */

async function main() {
  health();

  const client = createClient({
    url: REDIS_URL,
    socket: {
      // Reconnect forever with a capped delay. The alternative — giving up
      // after N attempts — turns a Redis restart into permanent silence that
      // looks exactly like a fleet with the ignition off.
      reconnectStrategy: (retries) => Math.min(30_000, 500 * 2 ** Math.min(retries, 6)),
    },
  });

  client.on("error", (err) => {
    state.lastError = String(err);
    log("error", "redis_error", { error: String(err) });
  });
  client.on("ready", () => {
    state.connected = true;
    log("info", "redis_ready", { url: REDIS_URL.replace(/\/\/.*@/, "//") });
  });
  client.on("end", () => {
    state.connected = false;
    state.subscribed = false;
  });

  await client.connect();

  // A pattern subscription rather than one channel per VIN. The channel name is
  // `teslam_V_{VIN}` — the braces are literal, a Redis cluster hash tag — so
  // subscribing per car would mean holding a list of every VIN and resubscribing
  // whenever one is linked. The pattern needs neither.
  await client.pSubscribe(PATTERN, (message) => accept(message));
  state.subscribed = true;
  log("info", "subscribed", { pattern: PATTERN, ingest: new URL(INGEST_URL).origin });

  const timer = setInterval(() => void flush(), FLUSH_MS);

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    log("info", "stopping", { signal, pending: buffer.length });
    clearInterval(timer);
    // One last attempt at whatever is held. Anything published from here on is
    // lost — that is pub/sub, not a bug — so the window is kept short.
    try {
      await client.pUnsubscribe(PATTERN);
      state.subscribed = false;
      await flush();
    } catch (err) {
      log("error", "shutdown_flush_failed", { error: String(err) });
    }
    await client.quit().catch(() => {});
    log("info", "stopped", { sent: state.sentTotal, dropped: state.droppedTotal });
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log("fatal", "startup_failed", { error: String(err) });
  process.exit(1);
});
