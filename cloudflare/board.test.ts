import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import REGISTRATIONS from "./migrations/0001_registrations.sql?raw";
import BOARD from "./migrations/0002_board.sql?raw";
import { createWorker, type Env } from "./worker";
import { LIMITS } from "../lib/board";

/**
 * The board, exercised against a real D1 in workerd.
 *
 * What is actually at stake here is not "does a post save". It is that a post
 * can only be written by somebody who confirmed a registration, that one
 * account is one vote no matter how many times the button is pressed, and that
 * nothing which identifies a registrant escapes through a route a browser can
 * reach. Those are the three ways this feature can be wrong in a way that
 * matters, and each has a test below.
 */

const E = env as unknown as Env;

/** Same stripping the registration suite uses: comments first, then whitespace,
 *  or a `--` line folds onto the statement after it and eats it. */
function statements(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function reset() {
  for (const t of ["post_votes", "comments", "posts", "sessions", "accounts", "registrations"]) {
    await E.DB.exec(`DROP TABLE IF EXISTS ${t}`);
  }
  for (const s of statements(REGISTRATIONS)) await E.DB.exec(s);
  for (const s of statements(BOARD)) await E.DB.exec(s);
}

const worker = createWorker();
const call = (req: Request) => worker.fetch(req, E);

const ORIGIN = { origin: "https://teslam.io" };

/** The API leg of a confirmation link minted for the site. */
const apiConfirm = (siteUrl: string) =>
  `https://api.teslam.io/v1/genesis/confirm?token=${new URL(siteUrl).searchParams.get("token")}`;

/**
 * Register and confirm, returning the session cookie the way a browser would
 * hold it.
 *
 * Deliberately routed through the real endpoints rather than inserting rows:
 * the thing being asserted downstream is that confirmation is what creates an
 * account, and a test that seeds `accounts` directly proves nothing about that.
 */
async function member(email: string): Promise<string> {
  const invited = await call(
    new Request("https://api.teslam.io/v1/genesis/invite", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-export-token",
        ...ORIGIN,
      },
      body: JSON.stringify({
        email,
        model: "Model 3",
        trim: "Long Range",
        region: "capital",
        kmBand: "1000_2000",
        consentTerms: true,
        consentPrivacy: true,
      }),
    }),
  );
  const { confirmUrl } = (await invited.json()) as { confirmUrl: string };

  // The minted link points at the site's confirmation page, which is what the
  // registrant clicks; that page then calls the API with the token. This is the
  // API leg, which is where the session is issued.
  const confirmed = await call(new Request(apiConfirm(confirmUrl), { headers: ORIGIN }));
  const setCookie = confirmed.headers.get("set-cookie");
  expect(setCookie, "confirmation did not issue a session").toBeTruthy();

  const token = /tsl_session=([^;]+)/.exec(setCookie!)?.[1];
  expect(token, "session cookie carried no token").toBeTruthy();
  return `tsl_session=${token}`;
}

const authed = (cookie: string, url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie,
      ...ORIGIN,
      ...(init.headers as Record<string, string>),
    },
  });

const anon = (url: string, init: RequestInit = {}) =>
  new Request(url, {
    ...init,
    headers: { "content-type": "application/json", ...ORIGIN, ...(init.headers as Record<string, string>) },
  });

const write = (cookie: string, body: unknown) =>
  call(
    authed(cookie, "https://api.teslam.io/v1/board/posts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

const A_POST = { board: "free", title: "첫 글", body: "안녕하세요" };

beforeEach(reset);

/* ── who may write ────────────────────────────────────────────────────── */

describe("only a confirmed registration can write", () => {
  it("refuses a post from a reader with no session", async () => {
    const res = await call(
      anon("https://api.teslam.io/v1/board/posts", {
        method: "POST",
        body: JSON.stringify(A_POST),
      }),
    );
    expect(res.status).toBe(401);
    expect(await E.DB.prepare("SELECT COUNT(*) AS n FROM posts").first<{ n: number }>()).toMatchObject({ n: 0 });
  });

  it("refuses a forged session token", async () => {
    const res = await call(
      authed("tsl_session=not-a-real-token", "https://api.teslam.io/v1/board/posts", {
        method: "POST",
        body: JSON.stringify(A_POST),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts a post from a confirmed member", async () => {
    const cookie = await member("writer@example.com");
    const res = await write(cookie, A_POST);
    expect(res.status).toBe(201);

    const list = await call(anon("https://api.teslam.io/v1/board/posts?sort=new"));
    const { posts } = (await list.json()) as { posts: Array<{ title: string; handle: string }> };
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("첫 글");
    // Assigned from the placement, so an account can post before it is named.
    expect(posts[0].handle).toMatch(/^genesis-\d{3}$/);
  });

  it("signing out stops the same cookie from writing again", async () => {
    const cookie = await member("leaver@example.com");
    expect((await write(cookie, A_POST)).status).toBe(201);

    const out = await call(
      authed(cookie, "https://api.teslam.io/v1/board/signout", { method: "POST" }),
    );
    expect(out.status).toBe(200);
    // The cookie is cleared in the response, but a stolen copy must also stop
    // working server-side — clearing the jar is not revocation.
    expect(out.headers.get("set-cookie")).toContain("Max-Age=0");

    expect((await write(cookie, A_POST)).status).toBe(401);
  });
});

/* ── one account, one vote ────────────────────────────────────────────── */

describe("voting", () => {
  it("toggles rather than accumulating", async () => {
    const cookie = await member("voter@example.com");
    const { id } = (await (await write(cookie, A_POST)).json()) as { id: string };
    const vote = () =>
      call(authed(cookie, `https://api.teslam.io/v1/board/posts/${id}/vote`, { method: "POST" }));

    expect(await (await vote()).json()).toEqual({ voted: true, votes: 1 });
    expect(await (await vote()).json()).toEqual({ voted: false, votes: 0 });
    expect(await (await vote()).json()).toEqual({ voted: true, votes: 1 });
  });

  it("counts two members separately and never counts one twice", async () => {
    const a = await member("a@example.com");
    const b = await member("b@example.com");
    const { id } = (await (await write(a, A_POST)).json()) as { id: string };

    const voteAs = (cookie: string) =>
      call(authed(cookie, `https://api.teslam.io/v1/board/posts/${id}/vote`, { method: "POST" }));

    const stored = async () =>
      (
        await E.DB.prepare("SELECT COUNT(*) AS n FROM post_votes WHERE post_id = ?")
          .bind(id)
          .first<{ n: number }>()
      )?.n;
    const shown = async () =>
      (
        (await (await call(anon(`https://api.teslam.io/v1/board/posts/${id}`))).json()) as {
          votes: number;
        }
      ).votes;

    await voteAs(a);
    await voteAs(b);
    // Two members, two votes. Checked against the stored rows as well as the
    // counter, because the counter is denormalised and could be internally
    // consistent while disagreeing with what was actually recorded.
    expect(await shown()).toBe(2);
    expect(await stored()).toBe(2);

    // b presses again. This is one member changing their mind, not a second
    // vote, and it must come back off rather than accumulating.
    await voteAs(b);
    expect(await shown()).toBe(1);
    expect(await stored()).toBe(1);
  });

  it("reports the caller's own vote state, and null when nobody is signed in", async () => {
    const cookie = await member("state@example.com");
    const { id } = (await (await write(cookie, A_POST)).json()) as { id: string };

    const mine = (await (await call(anon(`https://api.teslam.io/v1/board/posts/${id}`))).json()) as {
      voted: boolean | null;
    };
    expect(mine.voted, "a signed-out reader has no vote state, which is not the same as 'has not voted'").toBeNull();

    await call(authed(cookie, `https://api.teslam.io/v1/board/posts/${id}/vote`, { method: "POST" }));
    const after = (await (
      await call(authed(cookie, `https://api.teslam.io/v1/board/posts/${id}`))
    ).json()) as { voted: boolean | null };
    expect(after.voted).toBe(true);
  });
});

/* ── comments ─────────────────────────────────────────────────────────── */

describe("comments", () => {
  it("appear in the thread and keep the post's counter honest", async () => {
    const cookie = await member("commenter@example.com");
    const { id } = (await (await write(cookie, A_POST)).json()) as { id: string };

    for (const body of ["첫 댓글", "둘째 댓글"]) {
      const res = await call(
        authed(cookie, `https://api.teslam.io/v1/board/posts/${id}/comments`, {
          method: "POST",
          body: JSON.stringify({ body }),
        }),
      );
      expect(res.status).toBe(201);
    }

    const detail = (await (
      await call(anon(`https://api.teslam.io/v1/board/posts/${id}`))
    ).json()) as { comments: number; thread: Array<{ body: string }> };

    expect(detail.thread.map((c) => c.body)).toEqual(["첫 댓글", "둘째 댓글"]);
    expect(detail.comments, "the denormalised counter drifted from the thread").toBe(2);
  });

  it("refuses a comment on a post that does not exist", async () => {
    const cookie = await member("ghost@example.com");
    const res = await call(
      authed(cookie, "https://api.teslam.io/v1/board/posts/00000000-0000-4000-8000-000000000000/comments", {
        method: "POST",
        body: JSON.stringify({ body: "hello" }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

/* ── validation ───────────────────────────────────────────────────────── */

describe("what a post may contain", () => {
  it("names every field that is wrong, not just the first", async () => {
    const cookie = await member("invalid@example.com");
    const res = await write(cookie, { board: "nope", title: "", body: "" });
    expect(res.status).toBe(400);
    expect((await res.json()) as { fields: string[] }).toMatchObject({
      fields: ["board", "title", "body"],
    });
  });

  it("measures length in characters, so Korean is not charged double", async () => {
    const cookie = await member("length@example.com");
    // Exactly at the limit in code points. A UTF-8 byte count would make this
    // three times too long and reject a title a Korean writer sees as legal.
    const title = "가".repeat(LIMITS.title.max);
    expect((await write(cookie, { ...A_POST, title })).status).toBe(201);

    const tooLong = "가".repeat(LIMITS.title.max + 1);
    expect((await write(cookie, { ...A_POST, title: tooLong })).status).toBe(400);
  });

  it("treats whitespace as empty", async () => {
    const cookie = await member("blank@example.com");
    expect((await write(cookie, { ...A_POST, body: "   \n\t  " })).status).toBe(400);
  });

  it("rejects a body of malformed JSON without a stack trace", async () => {
    const cookie = await member("json@example.com");
    const res = await call(
      authed(cookie, "https://api.teslam.io/v1/board/posts", { method: "POST", body: "{" }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_json" });
  });
});

/* ── handles ──────────────────────────────────────────────────────────── */

describe("handles", () => {
  it("can be set once and then not again", async () => {
    const cookie = await member("named@example.com");
    const put = (handle: string) =>
      call(
        authed(cookie, "https://api.teslam.io/v1/board/handle", {
          method: "PUT",
          body: JSON.stringify({ handle }),
        }),
      );

    expect((await put("광교전비장인")).status).toBe(200);
    // A handle sits beside every post its owner ever wrote. Letting it change
    // freely would let somebody rewrite their own record of statements.
    expect((await put("다른이름")).status).toBe(409);
  });

  it("refuses a name already in use", async () => {
    const a = await member("first@example.com");
    const b = await member("second@example.com");
    const put = (cookie: string, handle: string) =>
      call(
        authed(cookie, "https://api.teslam.io/v1/board/handle", {
          method: "PUT",
          body: JSON.stringify({ handle }),
        }),
      );

    expect((await put(a, "겹치는이름")).status).toBe(200);
    expect((await put(b, "겹치는이름")).status).toBe(409);
  });

  it("refuses names that are not names", async () => {
    const cookie = await member("charset@example.com");
    for (const handle of ["a", "  ", "a".repeat(LIMITS.handle.max + 1), "has space", "<script>"]) {
      const res = await call(
        authed(cookie, "https://api.teslam.io/v1/board/handle", {
          method: "PUT",
          body: JSON.stringify({ handle }),
        }),
      );
      expect(res.status, `accepted ${JSON.stringify(handle)}`).toBe(400);
    }
  });
});

/* ── what escapes ─────────────────────────────────────────────────────── */

describe("nothing about a registrant leaks", () => {
  it("keeps the email and the registration id out of every public board response", async () => {
    const cookie = await member("private@example.com");
    const { id } = (await (await write(cookie, A_POST)).json()) as { id: string };

    const bodies = await Promise.all(
      [
        "https://api.teslam.io/v1/board/posts",
        `https://api.teslam.io/v1/board/posts/${id}`,
        "https://api.teslam.io/v1/board/counts",
        "https://api.teslam.io/v1/capabilities",
      ].map(async (u) => await (await call(anon(u))).text()),
    );

    const registration = await E.DB.prepare("SELECT id FROM registrations LIMIT 1").first<{ id: string }>();

    for (const body of bodies) {
      expect(body).not.toContain("private@example.com");
      expect(body).not.toContain(registration!.id);
      expect(body).not.toContain("account_id");
      expect(body).not.toContain("token");
    }
  });

  it("does not put the registration id in the confirmation response either", async () => {
    const invited = await call(
      new Request("https://api.teslam.io/v1/genesis/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-export-token",
          ...ORIGIN,
        },
        body: JSON.stringify({
          email: "leak@example.com",
          model: "Model 3",
          trim: "Long Range",
          region: "capital",
          kmBand: "1000_2000",
          consentTerms: true,
          consentPrivacy: true,
        }),
      }),
    );
    const { confirmUrl } = (await invited.json()) as { confirmUrl: string };
    const body = await (await call(new Request(apiConfirm(confirmUrl), { headers: ORIGIN }))).text();

    const registration = await E.DB.prepare("SELECT id FROM registrations LIMIT 1").first<{ id: string }>();
    expect(body).not.toContain(registration!.id);
    expect(body).not.toContain("leak@example.com");
  });
});

/* ── the session cookie itself ────────────────────────────────────────── */

describe("the session cookie", () => {
  it("is HttpOnly, and cross-site only because the origin allowlist stands behind it", async () => {
    const invited = await call(
      new Request("https://api.teslam.io/v1/genesis/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-export-token",
          ...ORIGIN,
        },
        body: JSON.stringify({
          email: "cookie@example.com",
          model: "Model 3",
          trim: "Long Range",
          region: "capital",
          kmBand: "1000_2000",
          consentTerms: true,
          consentPrivacy: true,
        }),
      }),
    );
    const { confirmUrl } = (await invited.json()) as { confirmUrl: string };
    const res = await call(new Request(apiConfirm(confirmUrl), { headers: ORIGIN }));
    const cookie = res.headers.get("set-cookie")!;

    // HttpOnly is what keeps the token out of any script on the page, and is
    // also why the site's source contains no storage API at all.
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=None");
  });

  it("is never issued to somebody who only read the board", async () => {
    // The privacy policy's claim is that browsing sets nothing. That is only
    // true if no public read path can produce a Set-Cookie.
    for (const u of [
      "https://api.teslam.io/v1/board/posts",
      "https://api.teslam.io/v1/board/counts",
      "https://api.teslam.io/v1/board/me",
      "https://api.teslam.io/v1/capabilities",
      "https://api.teslam.io/v1/genesis/stats",
    ]) {
      const res = await call(anon(u));
      expect(res.headers.get("set-cookie"), `${u} set a cookie for a signed-out reader`).toBeNull();
    }
  });
});

/* ── listing ──────────────────────────────────────────────────────────── */

describe("listing", () => {
  it("filters by board and refuses a board that does not exist", async () => {
    const cookie = await member("lister@example.com");
    await write(cookie, { board: "free", title: "자유 글", body: "x" });
    await write(cookie, { board: "fsd", title: "FSD 글", body: "x" });

    const free = (await (
      await call(anon("https://api.teslam.io/v1/board/posts?board=free&sort=new"))
    ).json()) as { posts: Array<{ title: string }> };
    expect(free.posts.map((p) => p.title)).toEqual(["자유 글"]);

    expect((await call(anon("https://api.teslam.io/v1/board/posts?board=nope"))).status).toBe(400);
  });

  it("reports whether another page exists without counting the table", async () => {
    // POSTS_PER_HOUR caps one account at ten, which is half a page, so three
    // members are needed to get one row past the page boundary this flag is
    // about. Twenty-one posts: page 0 is full and page 1 holds the remainder.
    const first_ = await member("pager1@example.com");
    const second = await member("pager2@example.com");
    const third = await member("pager3@example.com");
    for (let i = 0; i < 10; i += 1) await write(first_, { ...A_POST, title: `a${i}` });
    for (let i = 0; i < 10; i += 1) await write(second, { ...A_POST, title: `b${i}` });
    await write(third, { ...A_POST, title: "c0" });

    const first = (await (
      await call(anon("https://api.teslam.io/v1/board/posts?sort=new&page=0"))
    ).json()) as { posts: unknown[]; more: boolean };
    expect(first.posts).toHaveLength(20);
    expect(first.more).toBe(true);

    const next = (await (
      await call(anon("https://api.teslam.io/v1/board/posts?sort=new&page=1"))
    ).json()) as { posts: unknown[]; more: boolean };
    expect(next.posts).toHaveLength(1);
    expect(next.more).toBe(false);
  });

  it("stops one member from flooding the board", async () => {
    const cookie = await member("flood@example.com");
    for (let i = 0; i < 10; i += 1) {
      expect((await write(cookie, { ...A_POST, title: `p${i}` })).status).toBe(201);
    }
    expect((await write(cookie, { ...A_POST, title: "one too many" })).status).toBe(429);
  });
});

/* ── capabilities ─────────────────────────────────────────────────────── */

describe("the capabilities document", () => {
  it("says the board and seats are live and the odometer sections are not", async () => {
    const res = await call(anon("https://api.teslam.io/v1/capabilities"));
    const caps = (await res.json()) as Record<string, unknown>;

    expect(caps.board).toBe(true);
    expect(caps.seats).toBe(true);
    // Every one of these is computed from odometer readings and no vehicle is
    // linked yet. If one of them flips to true, the section it names must have
    // a real source behind it — that is the contract the site renders from.
    for (const k of ["league", "quests", "badges", "wallet", "garage", "shop"]) {
      expect(caps[k], `${k} claims a data source that does not exist`).toBe(false);
    }
  });

  it("carries the live post count so the site can tell empty from unavailable", async () => {
    const cookie = await member("counter@example.com");
    await write(cookie, A_POST);

    const caps = (await (await call(anon("https://api.teslam.io/v1/capabilities"))).json()) as {
      counts: { posts: number };
    };
    expect(caps.counts.posts).toBe(1);
  });
});
