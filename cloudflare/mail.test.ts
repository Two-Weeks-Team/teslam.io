import { describe, expect, it } from "vitest";
import { gmailMailer } from "./lib/mail";

/**
 * The Gmail route, without a network.
 *
 * What is worth testing here is the encoding, because it is the part that
 * fails quietly: a Korean subject that skips RFC 2047 arrives as question
 * marks, and a body sent as raw 8-bit arrives mangled. Both look fine in code
 * review and only show up in someone's inbox.
 */

type Call = { url: string; init: RequestInit };

function stubFetch(calls: Call[], onSend: (raw: string) => void) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({ access_token: "tok", expires_in: 3600 }),
        { status: 200 },
      );
    }
    onSend(JSON.parse(String(init.body)).raw);
    return new Response("{}", { status: 200 });
  };
}

const decode = (b64url: string) => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
  );
};

describe("gmail mailer", () => {
  it("encodes a Korean subject and body so they survive the wire", async () => {
    const calls: Call[] = [];
    let raw = "";
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch(calls, (r) => (raw = r)) as typeof fetch;

    try {
      const m = gmailMailer({
        clientId: "id",
        clientSecret: "secret",
        refreshToken: "refresh",
        from: "teslam.io <noreply@teslam.io>",
      });
      const ok = await m.send(
        "owner@example.com",
        "Genesis 500 등록을 확인해 주세요 — teslam.io",
        "좌석 번호를 받으려면 링크를 열어주세요.",
      );
      expect(ok).toBe(true);
    } finally {
      globalThis.fetch = original;
    }

    const mime = decode(raw);
    // The subject must be encoded, not passed through as raw bytes.
    expect(mime).toMatch(/^Subject: =\?UTF-8\?B\?/m);
    expect(mime).toContain("From: teslam.io <noreply@teslam.io>");
    expect(mime).toContain("To: owner@example.com");
    expect(mime).toContain("Content-Transfer-Encoding: base64");

    const body = mime.split("\r\n\r\n")[1].replace(/\r\n/g, "");
    expect(decode(body)).toContain("좌석 번호를 받으려면");
  });

  it("reuses one access token instead of refreshing per send", async () => {
    const calls: Call[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = stubFetch(calls, () => {}) as typeof fetch;

    try {
      const m = gmailMailer({
        clientId: "id",
        clientSecret: "secret",
        refreshToken: "refresh",
        from: "noreply@teslam.io",
      });
      await m.send("a@example.com", "s", "t");
      await m.send("b@example.com", "s", "t");
    } finally {
      globalThis.fetch = original;
    }

    const refreshes = calls.filter((c) => c.url.includes("oauth2")).length;
    expect(refreshes, "a token good for an hour was fetched twice").toBe(1);
  });

  it("reports failure rather than throwing when the token is refused", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("nope", { status: 400 })) as typeof fetch;

    try {
      const m = gmailMailer({
        clientId: "id",
        clientSecret: "bad",
        refreshToken: "refresh",
        from: "noreply@teslam.io",
      });
      // A registration must survive a broken mail route; the caller reports
      // mailSent: false and the row stays.
      await expect(m.send("a@example.com", "s", "t")).resolves.toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });
});
