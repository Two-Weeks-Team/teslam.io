import { existsSync, readFileSync } from "node:fs";
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

      it("renders the API cost, the true cash cost and the break-even", () => {
        for (const figure of [
          krw(locale, e.apiKrwPerMonth),
          krw(locale, e.cashCostPerVehicleMonth),
          krw(locale, e.breakevenKrwPerVehicleMonth),
        ]) {
          expect(doc(), `missing figure ${figure}`).toContain(figure);
        }
      });

      it("renders both Genesis figures, not just the flattering one", () => {
        expect(doc()).toContain(krw(locale, e.genesisApiKrwPerMonth));
        expect(doc()).toContain(krw(locale, e.genesisTotalKrwPerMonth));
      });

      it("renders the API share of cash out", () => {
        expect(doc()).toContain(pct(locale, e.apiShareOfCashCost));
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
