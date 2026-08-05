import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as e from "@/lib/economics";
import { krw, pct } from "@/lib/format";
import { getContent } from "@/lib/i18n";
import { ROUTE_D } from "@/lib/drive/route";

/**
 * Proves the figures are server-rendered rather than hydrated in.
 *
 * `lib/economics` is already tested for arithmetic. What this file asserts is
 * different and cannot be checked any other way: that the computed value
 * actually reached the shipped HTML, so a crawler, a social preview and a
 * reader with JavaScript disabled all see the same number.
 *
 * Requires a build. CI runs `pnpm build` before `pnpm test` for this reason.
 */
const PAGES = {
  ko: ".next/server/app/index.html",
  en: ".next/server/app/en.html",
} as const;

const built = existsSync(PAGES.ko) && existsSync(PAGES.en);

describe.runIf(built)("server-rendered figures", () => {
  const html = {
    ko: built ? readFileSync(PAGES.ko, "utf8") : "",
    en: built ? readFileSync(PAGES.en, "utf8") : "",
  };

  for (const locale of ["ko", "en"] as const) {
    describe(locale, () => {
      const doc = () => html[locale];

      it("declares the right language", () => {
        expect(doc()).toContain(`lang="${locale}"`);
      });

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

      it("renders the API share of cash cost", () => {
        expect(doc()).toContain(pct(locale, e.apiShareOfCashCost));
      });

      it("carries both disclaimers in the HTML itself", () => {
        const t = getContent(locale).footer;
        // Escaped exactly as React emits them.
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
        expect(doc()).toContain(esc(t.disclaimerTrademark));
        expect(doc()).toContain(esc(t.disclaimerFinancial));
      });

      it("ships the hero as a finished picture, without JavaScript", () => {
        // The whole route, drawn, plus the readout labels around it.
        expect(doc()).toContain(ROUTE_D.slice(0, 40));
        for (const k of ["LAT", "LNG", "SPD", "ODO", "DRV"]) {
          expect(doc(), `readout ${k} not server-rendered`).toContain(k);
        }
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
