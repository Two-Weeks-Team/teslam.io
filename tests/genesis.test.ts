import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { genesis as ko } from "@/content/ko/genesis";
import { genesis as en } from "@/content/en/genesis";
import { KM_BANDS, MODELS, REGIONS, SEATS, TRIMS, isEmail } from "@/lib/genesis";

/**
 * The registration screen.
 *
 * This is the only page on the site that asks a visitor for anything, so the
 * assertions are about what it takes and what it promises rather than about
 * layout: the form must be in the HTML without JavaScript, the consent must be
 * two separate deliberate ticks, and the list of what is never collected must
 * be on the same page as the field that collects.
 */

const PAGE = {
  ko: ".next/server/app/genesis.html",
  en: ".next/server/app/en/genesis.html",
} as const;

const built = Object.values(PAGE).every((p) => existsSync(p));
const read = (p: string) => (built ? readFileSync(p, "utf8") : "");

describe("the shared vocabulary", () => {
  it("gives every model at least one trim", () => {
    for (const m of MODELS) {
      expect(TRIMS[m].length, `${m} has no trims`).toBeGreaterThan(0);
    }
  });

  it("splits Korea finely enough for the capital not to swallow the map", () => {
    // Four regions was the sample data's mistake; density is unreadable when
    // most of the fleet lands in one shape.
    expect(REGIONS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
  });

  it("uses distinct ids for the distance bands", () => {
    expect(new Set(KM_BANDS.map((b) => b.id)).size).toBe(KM_BANDS.length);
  });

  it("accepts real addresses and refuses impossible ones", () => {
    for (const good of ["a@b.co", "owner+tag@sub.example.com", "이름@example.com"]) {
      expect(isEmail(good), `${good} should be accepted`).toBe(true);
    }
    for (const bad of ["", "nope", "a@b", "a b@c.com", "@example.com"]) {
      expect(isEmail(bad), `${bad} should be refused`).toBe(false);
    }
  });
});

describe("copy", () => {
  it("never promises a token in either locale", () => {
    for (const [name, t] of [
      ["ko", ko],
      ["en", en],
    ] as const) {
      const body = JSON.stringify(t);
      expect(body, `${name}: no disclaimer about issuance`).toMatch(
        /발행된 바 없|not been issued/,
      );
    }
  });

  it("says what is not collected, in both locales", () => {
    for (const t of [ko, en]) {
      expect(t.notCollected.items.length).toBeGreaterThanOrEqual(4);
    }
    expect(JSON.stringify(ko.notCollected)).toContain("위치");
    expect(JSON.stringify(en.notCollected)).toContain("Location");
  });
});

describe.runIf(built)("the rendered page", () => {
  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const doc = () => read(PAGE[locale]);

      it("ships the form without JavaScript", () => {
        for (const field of ["email", "model", "trim", "region", "kmBand"]) {
          expect(doc(), `field ${field} not server-rendered`).toContain(
            `name="${field}"`,
          );
        }
      });

      it("offers every region and band the API accepts", () => {
        for (const r of REGIONS) {
          expect(doc(), `region ${r.id} missing`).toContain(`value="${r.id}"`);
        }
        for (const b of KM_BANDS) {
          expect(doc(), `band ${b.id} missing`).toContain(`value="${b.id}"`);
        }
      });

      it("asks for terms and privacy as two separate required ticks", () => {
        expect(doc()).toContain('name="consentTerms"');
        expect(doc()).toContain('name="consentPrivacy"');
        // Marketing is offered but must not be required.
        expect(doc()).toContain('name="consentMarketing"');
        const marketing = doc().slice(doc().indexOf('name="consentMarketing"'));
        expect(marketing.slice(0, 120)).not.toContain("required");
      });

      it("links both consents to the document they consent to", () => {
        const privacy = locale === "ko" ? "/privacy" : "/en/privacy";
        const terms = locale === "ko" ? "/terms" : "/en/terms";
        expect(doc()).toContain(`href="${privacy}"`);
        expect(doc()).toContain(`href="${terms}"`);
      });

      it("puts the count and the cohort size in the HTML", () => {
        expect(doc()).toContain(String(SEATS));
      });

      it("lists what is never collected on the page that collects", () => {
        const t = locale === "ko" ? ko : en;
        for (const item of t.notCollected.items) {
          // Compare on the first clause; the rest contains punctuation React
          // escapes differently.
          const head = item.split(/[—-]/)[0].trim();
          expect(doc(), `missing: ${head}`).toContain(head);
        }
      });
    });
  }
});
