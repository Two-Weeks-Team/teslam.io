import {
  isEmail,
  isKmBand,
  isModel,
  isRegion,
  isTrim,
  normaliseEmail,
  type KmBandId,
  type Model,
  type RegionId,
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
  gmailMailer,
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
  /** Google Workspace, sending as an alias on a domain that account owns. */
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  MAIL_FROM?: string;
  EXPORT_TOKEN?: string;
  /**
   * Whether the public form accepts submissions. `"true"` opens it.
   *
   * This exists because the two halves of registration can be ready at
   * different times, and they were: the API, the placement and the board all
   * worked while no confirmation mail could leave the account. An open form in
   * that state takes an address, promises a link, and sends nothing — so the
   * gate is here, in front of the write, rather than in the page that draws the
   * form. A UI that merely hides the form still has an endpoint anyone can POST
   * to, which is not a closed registration.
   *
   * Flip to `"true"` in the same change that makes mail live, not before.
   */
  REGISTRATION_OPEN?: string;
};

/** Registration is closed unless the config says otherwise. */
const registrationOpen = (env: Env) => env.REGISTRATION_OPEN === "true";

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

type Submission = {
  email: string;
  model: Model;
  trim: string;
  region: RegionId;
  kmBand: KmBandId;
  consentMarketing: boolean;
  locale: "ko" | "en";
};

/**
 * Read a submission, or say which fields are wrong.
 *
 * Shared by the public form and the operator path so a row can never be
 * written through one route that the other would have rejected — including the
 * consent booleans, which are the part it would be most tempting to let an
 * operator skip.
 */
function parseSubmission(
  body: Record<string, unknown>,
): { ok: true; value: Submission } | { ok: false; fields: string[] } {
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
  if (bad.length) return { ok: false, fields: bad };

  return {
    ok: true,
    value: {
      email: email!,
      model: model!,
      trim: String(body.trim),
      region: region!,
      kmBand: kmBand!,
      consentMarketing: body.consentMarketing === true,
      locale: body.locale === "en" ? "en" : "ko",
    },
  };
}

/**
 * Write the pending row and mint its confirmation link.
 *
 * Returns null when the address already holds a place — the caller says so
 * without revealing anything else about it.
 */
async function stagePending(
  env: Env,
  s: Submission,
): Promise<{ link: string } | null> {
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256(token);

  const existing = await findByEmail(env.DB, s.email);
  if (existing?.verified_at) return null;

  const row = {
    email: s.email,
    model: s.model,
    trim: s.trim,
    region: s.region,
    kmBand: s.kmBand,
    consentMarketing: s.consentMarketing,
    tokenHash,
  };

  // Insert first when there is no row, and fall back to a refresh if another
  // request for the same address won the race. Checking then inserting left a
  // window where the loser raised a UNIQUE violation and the caller saw a 500.
  const inserted = existing === null && (await insertPending(env.DB, row));

  if (!inserted) {
    // Refresh the whole row, not just the token. Someone who resubmits after
    // changing their mind — a different car, or marketing unticked — would
    // otherwise be confirmed against the profile they replaced, and a stale
    // marketing opt-in is a consent record that says the opposite of what the
    // person just chose.
    await refreshPending(env.DB, row);
  }

  // English registrants were being sent to the Korean route: the message was
  // translated and the link was not.
  const path = s.locale === "en" ? "/en/genesis/confirm" : "/genesis/confirm";
  return { link: `${env.SITE_ORIGIN}${path}?token=${token}` };
}

async function register(
  req: Request,
  env: Env,
  deps: Deps,
  overLimit: Limiter,
): Promise<Response> {
  // Before the rate limiter and before the body is read: a closed registration
  // should cost a would-be registrant nothing and should write nothing.
  if (!registrationOpen(env)) {
    return json({ status: "closed" }, 503, { "retry-after": "86400" });
  }

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

  const parsed = parseSubmission(body);
  if (!parsed.ok) return json({ error: "invalid", fields: parsed.fields }, 400);

  const staged = await stagePending(env, parsed.value);
  // Already holds a place. Say so without revealing anything else.
  if (!staged) return json({ status: "already_registered" }, 200);

  const { email, locale } = parsed.value;
  const mail = confirmationMail(staged.link, locale);
  /*
   * Whichever route can actually send from a teslam.io address.
   *
   * Gmail first because that is the one configured: the domain lives in the
   * operator's Workspace, so `noreply@teslam.io` is an alias it may send as.
   * Cloudflare Email Sending would need no key at all and is preferred the
   * moment the account has it enabled. Resend is last — its plan holds one
   * domain and that slot belongs to another project.
   *
   * All three are optional. With none configured the registration is still
   * written and the caller is told no mail went out.
   */
  const from = env.MAIL_FROM ?? "noreply@teslam.io";
  const gmailReady =
    env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN;
  const mailer =
    deps.mailer ??
    (gmailReady
      ? gmailMailer({
          clientId: env.GMAIL_CLIENT_ID!,
          clientSecret: env.GMAIL_CLIENT_SECRET!,
          refreshToken: env.GMAIL_REFRESH_TOKEN!,
          from: `teslam.io <${from}>`,
        })
      : env.EMAIL
        ? cloudflareMailer(env.EMAIL, from)
        : env.RESEND_API_KEY
          ? resendMailer(env.RESEND_API_KEY, from)
          : null);

  const delivered = mailer ? await mailer.send(email, mail.subject, mail.text) : false;

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

/**
 * Operator authentication, in constant time.
 *
 * Two routes depend on this token now, so the comparison lives in one place
 * rather than being written twice slightly differently. `===` on a secret
 * leaks its length and its matching prefix through response timing; the work
 * to avoid that is four lines.
 */
function authorised(req: Request, env: Env): boolean {
  const presented = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const expected = env.EXPORT_TOKEN ?? "";
  if (!expected || presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Mint a confirmation link and return it instead of mailing it.
 *
 * With the public form closed and no mail leaving the account, everything after
 * confirmation — placement, the seat page, the board lighting up — is provable
 * only by tests, and a test passing is not the same as the thing working. This
 * lets the operator walk the whole path with an address they own.
 *
 * It deliberately reuses the public route's validation and its write, so it
 * cannot create a row the form would have refused; consent is required here
 * exactly as it is there. The only step it skips is delivery, and the link goes
 * to a caller who already holds the operator token.
 *
 * It ignores the registration gate on purpose — being able to exercise a closed
 * flow is the entire reason it exists.
 */
async function invite(req: Request, env: Env): Promise<Response> {
  if (!authorised(req, env)) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const parsed = parseSubmission(body);
  if (!parsed.ok) return json({ error: "invalid", fields: parsed.fields }, 400);

  const staged = await stagePending(env, parsed.value);
  if (!staged) return json({ status: "already_registered" }, 200);

  return json({ status: "pending", confirmUrl: staged.link });
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

      if (url.pathname === "/v1/genesis/invite" && req.method === "POST") {
        const res = await invite(req, env);
        return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...headers } });
      }

      if (url.pathname === "/v1/genesis/stats" && req.method === "GET") {
        // `open` rides along with the counts because the page that draws the
        // form needs it at render time, and one request that already exists is
        // cheaper than a second one that would have to agree with it.
        return json({ ...(await stats(env.DB)), open: registrationOpen(env) }, 200, {
          ...headers,
          "cache-control": "public, max-age=10",
        });
      }

      if (url.pathname === "/v1/genesis/export" && req.method === "GET") {
        if (!authorised(req, env)) {
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
