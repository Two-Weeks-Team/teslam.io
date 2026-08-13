import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GenesisForm } from "@/components/genesis/form";
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

/**
 * The form itself, rendered on its own.
 *
 * These used to read the built page, which stopped working the moment
 * registration could be closed: the page then ships a waiting state and the
 * form is not in the HTML at all. Skipping the assertions in that case would
 * have been the worst option available — the form would go unchecked for
 * exactly the months it is not being exercised by anyone, and come back on the
 * day it matters most.
 *
 * So the component is rendered directly. `renderToStaticMarkup` needs no DOM
 * and no build, and it asserts the same thing the artefact did: the fields the
 * API expects, offered with the vocabulary the API accepts.
 */
describe("the registration form", () => {
  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const html = renderToStaticMarkup(createElement(GenesisForm, { locale }));

      it("renders every field without JavaScript", () => {
        for (const field of ["email", "model", "trim", "region", "kmBand"]) {
          expect(html, `field ${field} missing`).toContain(`name="${field}"`);
        }
      });

      it("offers every region and band the API accepts", () => {
        for (const r of REGIONS) {
          expect(html, `region ${r.id} missing`).toContain(`value="${r.id}"`);
        }
        for (const b of KM_BANDS) {
          expect(html, `band ${b.id} missing`).toContain(`value="${b.id}"`);
        }
      });

      it("asks for terms and privacy as two separate required ticks", () => {
        expect(html).toContain('name="consentTerms"');
        expect(html).toContain('name="consentPrivacy"');
        // Marketing is offered but must not be required.
        expect(html).toContain('name="consentMarketing"');
        const marketing = html.slice(html.indexOf('name="consentMarketing"'));
        expect(marketing.slice(0, 120)).not.toContain("required");
      });

      it("links both consents to the document they consent to", () => {
        const privacy = locale === "ko" ? "/privacy" : "/en/privacy";
        const terms = locale === "ko" ? "/terms" : "/en/terms";
        expect(html).toContain(`href="${privacy}"`);
        expect(html).toContain(`href="${terms}"`);
      });
    });
  }
});

describe.runIf(built)("the rendered page", () => {
  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const doc = () => read(PAGE[locale]);

      /**
       * Whichever half the build shipped, it has to be whole.
       *
       * The page shows the form or the waiting state, never both and never
       * neither — a page with the form missing and no explanation in its place
       * is the failure this pair of assertions exists to catch.
       */
      it("ships either the form or the waiting state, and says which", () => {
        const t = locale === "ko" ? ko : en;
        const hasForm = doc().includes('name="consentPrivacy"');

        if (hasForm) {
          expect(doc()).toContain('name="email"');
        } else {
          expect(doc(), "closed, but the page does not say so").toContain(
            t.closed.title,
          );
          expect(doc()).toContain(t.closed.next[0].split(/[—-]/)[0].trim());
        }
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
