import {
  isEmail,
  isKmBand,
  isModel,
  isRegion,
  isTrim,
  normaliseEmail,
  type Model,
} from "../lib/genesis";
import {
  confirm,
  findByEmail,
  insertPending,
  refreshPending,
  stats,
  purgeExpired,
  takenCount,
} from "./lib/db";
import {
  cloudflareMailer,
  confirmationMail,
  resendMailer,
  type EmailBinding,
  type Mailer,
} from "./lib/mail";

export { LiveBoard } from "./live";

export type Env = {
  DB: D1Database;
  LIVE: DurableObjectNamespace;
  /** Cloudflare Email Sending. Absent until the account is onboarded. */
  EMAIL?: EmailBinding;
  ALLOWED_ORIGINS: string;
  SITE_ORIGIN: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  EXPORT_TOKEN?: string;
};

/**
 * One board for everyone.
 *
 * A named instance rather than a per-region one: the whole point of the map is
 * that a seat taken in Jeju is visible from Seoul, and sharding by location
 * would give each region its own private, quieter room.
 */
const board = (env: Env) => env.LIVE.get(env.LIVE.idFromName("genesis"));

/* ── plumbing ─────────────────────────────────────────────────────────── */

const json = (body: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

/**
 * An explicit allowlist, never `*`.
 *
 * These endpoints write to a table of personal data. Reflecting an arbitrary
 * Origin back would let any page on the internet drive registration from a
 * visitor's browser.
 */
function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    vary: "origin",
  };
}

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Rate limiting, in memory, per worker instance.
 *
 * Deliberately modest: it blunts a loop from one address, not a distributed
 * flood. What actually protects the seat count is that a seat requires a
 * confirmed mailbox, so volume alone buys an attacker nothing. Cloudflare's own
 * rate limiting sits in front for the rest.
 *
 * Invalid submissions count against the budget too. Not charging for them
 * would leave a free channel: an attacker sends malformed bodies forever and
 * only pays once they send a valid one.
 */
const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * State lives on the worker instance, not on the module.
 *
 * Module-level state in a Worker is per-isolate and shared by every request
 * that isolate happens to serve — which reads as global, behaves as neither,
 * and made four tests fail by leaking a spent budget from one into the next.
 * Scoping it to the instance makes the lifetime something you can point at.
 */
function makeLimiter() {
  const hits = new Map<string, number[]>();
  return function overLimit(key: string, now: number): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.set(key, recent);
    if (recent.length >= LIMIT) return true;
    recent.push(now);
    return false;
  };
}

/* ── handlers ─────────────────────────────────────────────────────────── */

type Deps = { mailer?: Mailer; now?: () => number };
type Limiter = (key: string, now: number) => boolean;

async function register(
  req: Request,
  env: Env,
  deps: Deps,
  overLimit: Limiter,
): Promise<Response> {
  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  if (overLimit(ip, (deps.now ?? Date.now)())) {
    return json({ error: "rate_limited" }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const email = isEmail(body.email) ? normaliseEmail(body.email) : null;
  const model = isModel(body.model) ? (body.model as Model) : null;
  const region = isRegion(body.region) ? body.region : null;
  const kmBand = isKmBand(body.kmBand) ? body.kmBand : null;
  const trimOk = model !== null && isTrim(model, body.trim);

  const bad: string[] = [];
  if (!email) bad.push("email");
  if (!model) bad.push("model");
  if (!trimOk) bad.push("trim");
  if (!region) bad.push("region");
  if (!kmBand) bad.push("kmBand");
  // Consent is required and must be given, not defaulted.
  if (body.consentTerms !== true) bad.push("consentTerms");
  if (body.consentPrivacy !== true) bad.push("consentPrivacy");
  if (bad.length) return json({ error: "invalid", fields: bad }, 400);

  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256(token);

  const existing = await findByEmail(env.DB, email!);
  if (existing?.verified_at) {
    // Already holds a place. Say so without revealing anything else.
    return json({ status: "already_registered" }, 200);
  }
  // Insert first when there is no row, and fall back to a refresh if another
  // request for the same address won the race. Checking then inserting left a
  // window where the loser raised a UNIQUE violation and the caller saw a 500.
  const inserted =
    existing === null &&
    (await insertPending(env.DB, {
      email: email!,
      model: model!,
      trim: String(body.trim),
      region: region!,
      kmBand: kmBand!,
      consentMarketing: body.consentMarketing === true,
      tokenHash,
    }));

  if (!inserted) {
    // Refresh the whole row, not just the token. Someone who resubmits after
    // changing their mind — a different car, or marketing unticked — would
    // otherwise be confirmed against the profile they replaced, and a stale
    // marketing opt-in is a consent record that says the opposite of what the
    // person just chose.
    await refreshPending(env.DB, {
      email: email!,
      model: model!,
      trim: String(body.trim),
      region: region!,
      kmBand: kmBand!,
      consentMarketing: body.consentMarketing === true,
      tokenHash,
    });
  }

  const locale = body.locale === "en" ? "en" : "ko";
  // English registrants were being sent to the Korean route: the message was
  // translated and the link was not.
  const path = locale === "en" ? "/en/genesis/confirm" : "/genesis/confirm";
  const link = `${env.SITE_ORIGIN}${path}?token=${token}`;
  const mail = confirmationMail(link, locale);
  // Cloudflare first — no key to leak, one processor instead of two. Resend
  // stays as a fallback so the flow is not blocked on a beta product being
  // enabled, and tests inject their own collector.
  const from = env.MAIL_FROM ?? "genesis@teslam.io";
  const mailer =
    deps.mailer ??
    (env.EMAIL
      ? cloudflareMailer(env.EMAIL, from)
      : env.RESEND_API_KEY
        ? resendMailer(env.RESEND_API_KEY, from)
        : null);

  const delivered = mailer ? await mailer.send(email!, mail.subject, mail.text) : false;

  // A send failure does not lose the registration — the row is written and the
  // address can ask for the mail again. Reporting success here would be a lie
  // the registrant only discovers by waiting for a mail that never comes.
  return json({ status: "pending", mailSent: delivered });
}

async function confirmHandler(url: URL, env: Env): Promise<Response> {
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "missing_token" }, 400);

  const placement = await confirm(env.DB, await sha256(token));
  if (!placement) return json({ error: "invalid_or_used" }, 404);

  // Tell everyone watching. A failure here must not fail the confirmation —
  // the seat is already the registrant's, and a board that missed one event
  // corrects itself on the next page load.
  if (placement.kind === "seat") {
    try {
      await board(env).fetch("https://live/notify", {
        method: "POST",
        body: JSON.stringify({
          type: "seat.taken",
          seatNo: placement.number,
          region: placement.region,
          model: placement.model,
          taken: await takenCount(env.DB),
        }),
      });
    } catch {
      // Intentionally swallowed. See above.
    }
  }

  return json({ status: "confirmed", placement });
}

/* ── entry ────────────────────────────────────────────────────────────── */

export function createWorker(deps: Deps = {}) {
  const overLimit = makeLimiter();

  return {
    async fetch(req: Request, env: Env): Promise<Response> {
      const url = new URL(req.url);
      const headers = cors(req, env);

      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

      if (url.pathname === "/v1/genesis/register" && req.method === "POST") {
        const res = await register(req, env, deps, overLimit);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...headers } });
      }

      if (url.pathname === "/v1/genesis/confirm" && req.method === "GET") {
        const res = await confirmHandler(url, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...headers } });
      }

      if (url.pathname === "/v1/live") {
        if (req.headers.get("upgrade") !== "websocket") {
          return json({ error: "expected_websocket" }, 426, headers);
        }
        // Origin is checked here rather than left to the browser: WebSocket
        // upgrades are not subject to CORS, so a page anywhere could otherwise
        // open a socket and count the room.
        const origin = req.headers.get("origin") ?? "";
        const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
        if (origin && !allowed.includes(origin)) {
          return json({ error: "origin_not_allowed" }, 403);
        }
        return board(env).fetch(req);
      }

      if (url.pathname === "/v1/genesis/stats" && req.method === "GET") {
        return json(await stats(env.DB), 200, {
          ...headers,
          "cache-control": "public, max-age=10",
        });
      }

      if (url.pathname === "/v1/genesis/export" && req.method === "GET") {
        const auth = req.headers.get("authorization") ?? "";
        if (!env.EXPORT_TOKEN || auth !== `Bearer ${env.EXPORT_TOKEN}`) {
          return json({ error: "unauthorized" }, 401, headers);
        }
        const rows = await env.DB.prepare(
          `SELECT seat_no, waitlist_no, email, model, trim, region, km_band,
                  consent_marketing, consent_at, verified_at
             FROM registrations ORDER BY seat_no, waitlist_no`,
        ).all();
        return json({ rows: rows.results ?? [] }, 200, headers);
      }

      return json({ error: "not_found" }, 404, headers);
    },

    /**
     * The confirmation mail promises that an unconfirmed registration is
     * deleted. Nothing kept that promise until this handler existed — the row
     * simply sat there with a token that never expired.
     */
    async scheduled(_event: unknown, env: Env): Promise<void> {
      await purgeExpired(env.DB);
    },
  };
}

export default createWorker();
