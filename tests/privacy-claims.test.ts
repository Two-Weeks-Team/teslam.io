import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { legal as ko } from "@/content/ko/legal";
import { legal as en } from "@/content/en/legal";
import pkg from "../package.json";

/**
 * The privacy policy makes two kinds of promise, and both are checkable here.
 *
 * The first is a claim about this codebase — no local storage, no analytics,
 * and no cookie set by anything the site itself ships. A policy that says that
 * while a tracking script sits in the bundle is not a mistake in wording, it is
 * a false statement to every reader. So the claim is pinned: add an analytics
 * package or touch document.cookie and this fails until the policy is rewritten
 * to match.
 *
 * The policy used to say "no cookies" flatly, and the board's sign-in made that
 * false. The session cookie is set by the Worker and is HttpOnly, so no storage
 * API appears in the site's source and the scan below still passes — which is
 * exactly why the scan alone was not enough, and why §9 is now checked for the
 * disclosure it has to carry.
 *
 * The second is statutory. Article 30(1) of the Personal Information Protection
 * Act lists what a policy must contain. The list below is that statute, and the
 * assertions check the published document actually addresses each item rather
 * than trusting that it was remembered.
 */

/* ── The claim about the code ─────────────────────────────────────────── */

const SOURCE_DIRS = ["app", "components", "lib", "content"];
const CODE_EXT = /\.(ts|tsx|css)$/;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, acc);
    else if (CODE_EXT.test(entry)) acc.push(p);
  }
  return acc;
}

/**
 * Deliberately broad. A near-miss here costs one line in an allowlist; a miss
 * means the site quietly starts tracking people while promising it does not.
 */
const TRACKING = [
  /document\.cookie/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bgtag\s*\(/,
  /googletagmanager/i,
  /google-analytics/i,
  /\bplausible\b/i,
  /\bposthog\b/i,
  /\bmixpanel\b/i,
  /@vercel\/analytics/,
  /@vercel\/speed-insights/,
];

describe("the site does what the privacy policy says it does", () => {
  const files = SOURCE_DIRS.flatMap((d) => sourceFiles(d));

  it("ships no cookie, storage or analytics code", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const body = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rule of TRACKING) {
        if (rule.test(body)) offenders.push(`${f} matches ${rule}`);
      }
    }
    expect(
      offenders,
      "privacy policy §9 promises no automatic collection — update the policy before adding any of these",
    ).toEqual([]);
  });

  it("depends on no analytics package", () => {
    const deps = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    const bad = deps.filter((d) =>
      /analytic|insight|telemetry|tracking|segment|amplitude/i.test(d),
    );
    expect(bad, "an analytics dependency contradicts privacy policy §9").toEqual(
      [],
    );
  });

  /**
   * The session cookie is real, so the policy has to name it.
   *
   * This is the check that would have caught the version of this change that
   * shipped a sign-in and left §9 saying "no cookies". The code scan above
   * could not: the cookie is set by the Worker, over HTTP, and touches nothing
   * the scan reads.
   */
  it("discloses the session cookie, since the board sets one", () => {
    const usesSession = readFileSync("cloudflare/worker.ts", "utf8").includes("tsl_session");
    expect(usesSession, "if the session cookie is gone, this guard and §9 can both be relaxed").toBe(
      true,
    );

    for (const [name, doc] of [
      ["ko", ko.privacy],
      ["en", en.privacy],
    ] as const) {
      const body = JSON.stringify(doc);
      expect(body, `${name}: §9 does not name the session cookie`).toContain("tsl_session");
      expect(
        /쿠키를? (일절 )?(사용하지|쓰지) 않|[Nn]o cookies/.test(body),
        `${name}: §9 still claims no cookies while the board sets one`,
      ).toBe(false);
    }
  });

  it("names a data protection contact, as article 30(1)9 requires", () => {
    for (const [name, doc] of [
      ["ko", ko.privacy],
      ["en", en.privacy],
    ] as const) {
      const body = JSON.stringify(doc);
      expect(body, `${name}: no contact address in the policy`).toContain(
        "hello@teslam.io",
      );
    }
  });
});

/* ── The statutory checklist ──────────────────────────────────────────── */

/**
 * Article 30(1), item by item. Each entry lists words that must appear
 * somewhere in the policy for that item to be addressed at all. This cannot
 * judge whether the wording is adequate — only that the subject is not simply
 * absent, which is the failure mode that actually happens.
 */
const ARTICLE_30 = [
  { item: "1. 처리 목적", ko: ["이용 목적"], en: ["How it is used"] },
  { item: "2. 처리 및 보유 기간", ko: ["보유 기간"], en: ["Retention"] },
  { item: "3. 제3자 제공", ko: ["제3자 제공"], en: ["third parties"] },
  { item: "4. 파기절차 및 방법", ko: ["파기"], en: ["Deletion", "deleted"] },
  { item: "5. 민감정보", ko: ["민감정보"], en: ["sensitive"] },
  { item: "6. 처리 위탁", ko: ["처리 위탁", "위탁"], en: ["Processors"] },
  { item: "7. 가명정보", ko: ["가명정보"], en: ["pseudonymised"] },
  {
    item: "8. 정보주체·법정대리인의 권리",
    ko: ["법정대리인", "권리"],
    en: ["legal guardian", "rights"],
  },
  {
    item: "9. 보호책임자 성명 또는 부서·연락처",
    ko: ["개인정보 보호책임자"],
    en: ["Data protection officer"],
  },
  {
    item: "10. 자동 수집 장치",
    ko: ["자동 수집", "쿠키"],
    en: ["Automatic collection", "cookies"],
  },
] as const;

describe("the policy addresses every item in article 30(1)", () => {
  it.each(ARTICLE_30)("$item", ({ item, ko: koWords, en: enWords }) => {
    const koBody = JSON.stringify(ko.privacy);
    const enBody = JSON.stringify(en.privacy);
    expect(
      koWords.some((w) => koBody.includes(w)),
      `ko privacy policy does not address 「${item}」`,
    ).toBe(true);
    expect(
      enWords.some((w) => enBody.includes(w)),
      `en privacy policy does not address 「${item}」`,
    ).toBe(true);
  });
});
