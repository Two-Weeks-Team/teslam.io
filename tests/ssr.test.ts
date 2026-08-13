import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as e from "@/lib/economics";
import { krw, pct } from "@/lib/format";
import { getContent } from "@/lib/i18n";
import { ROUTE_D } from "@/lib/drive/route";
import community from "@/data/community.json";

/**
 * Proves the pages are server-rendered rather than hydrated in.
 *
 * `lib/economics` is already tested for arithmetic. What this asserts is
 * different and cannot be checked any other way: that the computed value
 * actually reached the shipped HTML, so a crawler, a social preview and a
 * reader with JavaScript disabled all see the same thing.
 *
 * Requires a build. CI runs `pnpm build` before `pnpm test` for this reason.
 */
const PAGES = {
  home: { ko: ".next/server/app/index.html", en: ".next/server/app/en.html" },
  model: { ko: ".next/server/app/model.html", en: ".next/server/app/en/model.html" },
} as const;

const built = Object.values(PAGES).every((g) =>
  Object.values(g).every((p) => existsSync(p)),
);

const read = (p: string) => (built ? readFileSync(p, "utf8") : "");
/** Escaped exactly as React emits it into HTML. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;");

describe.runIf(built)("the operating model page", () => {
  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const doc = () => read(PAGES.model[locale]);

      /**
       * The exchange rate is now fetched per request, so the page cannot be
       * checked against a constant. It is checked against itself instead: the
       * rate it publishes in `data-fx` must be the rate every won figure on it
       * was computed with.
       *
       * This is a stronger test than the old one, not a weaker substitute. The
       * previous version could only prove the page agreed with a number in a
       * file; this proves the page agrees with the number it showed the reader,
       * which is the thing a reader can actually check.
       */
      const quotedRate = () => {
        const m = doc().match(/data-fx="([\d.]+)"/);
        expect(m, "the page does not publish the rate it used").not.toBeNull();
        return Number(m![1]);
      };

      it("publishes a plausible rate with the day it is for", () => {
        const rate = quotedRate();
        expect(rate).toBeGreaterThan(500);
        expect(rate).toBeLessThan(5000);
        expect(doc()).toMatch(/data-fx-as-of="\d{4}-\d{2}-\d{2}"/);
        expect(doc()).toMatch(/data-fx-source="(ecb|whitepaper)"/);
      });

      it("renders the API cost, the true cash cost and the break-even", () => {
        const live = e.deriveAt(quotedRate());
        for (const figure of [
          krw(locale, live.apiKrwPerMonth),
          krw(locale, live.cashCostPerVehicleMonth),
          krw(locale, live.breakevenKrwPerVehicleMonth),
        ]) {
          expect(doc(), `missing figure ${figure}`).toContain(figure);
        }
      });

      it("renders both Genesis figures, not just the flattering one", () => {
        const live = e.deriveAt(quotedRate());
        expect(doc()).toContain(krw(locale, live.genesisApiKrwPerMonth));
        expect(doc()).toContain(krw(locale, live.genesisTotalKrwPerMonth));
      });

      it("renders the API share of cash out", () => {
        const live = e.deriveAt(quotedRate());
        expect(doc()).toContain(pct(locale, live.apiShareOfCashCost));
      });

      /**
       * The machine mirror must quote the page's rate, not its own.
       *
       * This test exists because the mirror silently drifted the first time the
       * rate went live: the page said ₩2,108 while `/llms.txt` still said
       * ₩2,107, because two of the mirror's figures were still reading the
       * static constant. Nothing else caught it — the suites agreed with
       * themselves, and only comparing the two artefacts revealed the gap.
       */
      it("quotes the same figures to a machine as to a person", () => {
        // `llms.txt` is also a directory in the build output, so existence is
        // not enough — the body file is the one that holds the rendered text.
        const mirror = ["llms.txt.body", "llms.txt"]
          .map((f) => join(".next/server/app", f))
          .filter((p) => existsSync(p) && statSync(p).isFile())
          .map((p) => readFileSync(p, "utf8"))[0];
        expect(mirror, "no rendered /llms.txt in the build output").toBeTruthy();

        const live = e.deriveAt(quotedRate());
        for (const figure of [
          live.apiKrwPerMonth,
          live.cashCostPerVehicleMonth,
        ]) {
          const asWon = Math.round(figure).toLocaleString("en-US");
          expect(
            mirror,
            `/llms.txt is missing ${asWon} — the mirror and the page disagree`,
          ).toContain(asWon);
        }
      });

      it("ships the hero as a finished picture, without JavaScript", () => {
        expect(doc()).toContain(ROUTE_D.slice(0, 40));
        for (const k of ["LAT", "LNG", "SPD", "ODO", "DRV"]) {
          expect(doc(), `readout ${k} not server-rendered`).toContain(k);
        }
      });
    });
  }
});

describe.runIf(built)("the community front page", () => {
  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const doc = () => read(PAGES.home[locale]);

      it("declares the right language", () => {
        expect(doc()).toContain(`lang="${locale}"`);
      });

      it("labels the sample content in the HTML itself", () => {
        if (!community.isPreview) return;
        expect(doc()).toContain(esc(getContent(locale).preview.body));
      });

      it("draws all 500 Genesis seats server-side", () => {
        // Anchored so the wrapper's `seats`/`seats__grid` classes do not count.
        const seats = (doc().match(/class="seat(?: seat--(?:on|you))?"/g) ?? [])
          .length;
        expect(seats).toBe(community.genesis.seats);
        expect(doc()).toContain("seat seat--you");
      });

      it("renders the leaderboard and the empty row that sells it", () => {
        expect(doc()).toContain(community.leaderboard[0].name);
        expect(doc()).toContain(esc(getContent(locale).league.yourRow));
      });

      it("renders the board itself, not a placeholder", () => {
        expect(doc()).toContain(esc(community.posts[0].title));
        expect(doc()).toContain(esc(community.posts[1].title));
      });

      it("carries both disclaimers", () => {
        const t = getContent(locale).footer;
        expect(doc()).toContain(esc(t.disclaimerTrademark));
        expect(doc()).toContain(esc(t.disclaimerFinancial));
      });

      it("links out to the operating model rather than burying it", () => {
        expect(doc()).toContain(esc(getContent(locale).nav.model));
      });
    });
  }
});

describe("build artefacts", () => {
  it("has a build to inspect", () => {
    expect(
      built,
      "run `pnpm build` before `pnpm test` — ssr.test.ts reads the built HTML",
    ).toBe(true);
  });
});
