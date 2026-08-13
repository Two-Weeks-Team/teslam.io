/**
 * Confirmation mail.
 *
 * Double opt-in is not politeness here, it is what makes the seat counter true.
 * The front page presents "N of 500 taken" as the one real number on an
 * otherwise sample board; if an unconfirmed address could hold a seat, anyone
 * with a script could make that number say anything.
 *
 * The sender is an interface so tests never send. A test that needs a live
 * provider is a test nobody runs.
 */

export type Mailer = {
  send(to: string, subject: string, text: string): Promise<boolean>;
};

/** Never sends. Records what would have been sent, for assertions. */
export function collectingMailer() {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const mailer: Mailer = {
    async send(to, subject, text) {
      sent.push({ to, subject, text });
      return true;
    },
  };
  return { mailer, sent };
}

/**
 * Cloudflare Email Sending, through the Worker binding.
 *
 * Preferred over an external provider because there is no API key to hold: the
 * binding is the credential, so nothing about mail delivery can leak from a
 * config file or a compromised secret store. It also keeps the registrant's
 * address inside one vendor rather than two, which is one fewer processor to
 * name in the privacy policy.
 *
 * Requires Email Sending enabled on the account and `teslam.io` onboarded.
 * Until then this returns false and the caller records the registration
 * without claiming a mail was sent.
 */
export type EmailBinding = {
  send(message: {
    to: string;
    from: { email: string; name?: string };
    subject: string;
    text: string;
  }): Promise<unknown>;
};

export function cloudflareMailer(binding: EmailBinding, from: string): Mailer {
  return {
    async send(to, subject, text) {
      try {
        await binding.send({
          to,
          from: { email: from, name: "teslam.io" },
          subject,
          text,
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/* ── Gmail ────────────────────────────────────────────────────────────── */

export type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** The address to send as. Must be a Workspace alias the account may use. */
  from: string;
};

/** Base64url without padding, over bytes rather than code units. */
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/**
 * RFC 2047 for the subject, base64 for the body.
 *
 * Both are required here rather than optional: the Korean subject line is not
 * ASCII, and a raw 8-bit body is what makes a message arrive with its hangul
 * replaced by question marks.
 */
function mime(from: string, to: string, subject: string, text: string): string {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64url(utf8(subject)).replace(/-/g, "+").replace(/_/g, "/")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    btoa(String.fromCharCode(...utf8(text))).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

/**
 * Send through Gmail, using the Workspace account the domain belongs to.
 *
 * The API is plain HTTPS, which is what makes it usable here — a Worker cannot
 * reliably hold the raw TCP connection SMTP needs, and Cloudflare blocks the
 * ports it would use.
 *
 * Access tokens last about an hour, so one is kept per worker instance and
 * refreshed only when it expires. Refreshing on every send would triple the
 * latency of a registration and burn quota for nothing.
 */
export function gmailMailer(cfg: GmailConfig): Mailer {
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string | null> {
    if (token && Date.now() < token.expiresAt - 60_000) return token.value;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          refresh_token: cfg.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!body.access_token) return null;
      token = {
        value: body.access_token,
        expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
      };
      return token.value;
    } catch {
      return null;
    }
  }

  return {
    async send(to, subject, text) {
      const bearer = await accessToken();
      if (!bearer) return false;
      try {
        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${bearer}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              raw: b64url(utf8(mime(cfg.from, to, subject, text))),
            }),
          },
        );
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(to, subject, text) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ from, to, subject, text }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Plain text, not HTML.
 *
 * Nothing in this message needs markup, and a text body cannot carry a tracking
 * pixel — which matters because the privacy policy says there is no automatic
 * collection anywhere, and mail is the easiest place to break that promise
 * without noticing.
 */
export function confirmationMail(link: string, locale: "ko" | "en") {
  if (locale === "en") {
    return {
      subject: "Confirm your Genesis 500 registration — teslam.io",
      text: [
        "You asked to hold a seat in the Genesis 500 cohort.",
        "",
        "Open this link to confirm and receive your seat number:",
        link,
        "",
        "The link works once. No seat is held until you use it.",
        "",
        "Registration costs nothing and promises no token. DRV and TSLM have",
        "not been issued. If someone asks you for money in our name, it is not us.",
        "",
        "If you did not ask for this, ignore this message — nothing was stored",
        "beyond the address it was sent to, and it is deleted unconfirmed.",
        "",
        "teslam.io — an independent community project, not affiliated with Tesla, Inc.",
      ].join("\n"),
    };
  }

  return {
    subject: "Genesis 500 등록을 확인해 주세요 — teslam.io",
    text: [
      "Genesis 500 좌석을 신청하셨습니다.",
      "",
      "아래 링크를 열면 확인이 완료되고 좌석 번호를 받습니다:",
      link,
      "",
      "링크는 한 번만 작동합니다. 확인 전에는 좌석이 배정되지 않습니다.",
      "",
      "사전 등록에는 어떤 대가도 없으며 토큰을 약속하지 않습니다. DRV와 TSLM은",
      "발행된 바 없습니다. 저희 이름으로 금전을 요구하는 연락은 저희가 보낸 것이 아닙니다.",
      "",
      "신청하신 적이 없다면 이 메일을 무시하셔도 됩니다. 이 주소 외에 저장된 것은",
      "없으며, 확인되지 않은 신청은 파기됩니다.",
      "",
      "teslam.io — Tesla, Inc.와 무관한 독립 커뮤니티 프로젝트입니다.",
    ].join("\n"),
  };
}
