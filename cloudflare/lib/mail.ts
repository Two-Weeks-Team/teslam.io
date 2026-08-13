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
