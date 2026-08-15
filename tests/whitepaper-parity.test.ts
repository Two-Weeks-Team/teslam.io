import { describe, expect, it } from "vitest";
import * as e from "@/lib/economics";
import model from "@/data/model.json";
import wp from "@/data/whitepaper-params.json";

/**
 * The site's numbers against the whitepaper's numbers.
 *
 * `data/model.json` is the site's input file and `data/whitepaper-params.json`
 * is a transcription of what the whitepaper actually specifies. Every figure a
 * visitor reads is derived from the first; the business case is argued in the
 * second. When they disagree, the site is publishing a number the company does
 * not stand behind — which is exactly what happened before this file existed:
 * `pricePerSignalUsd` sat at the October 2024 pre-revision tariff, 15× the
 * current price, for as long as nobody re-read §7.2.
 *
 * Failing here is not a bug in the code. It means someone changed an input
 * without changing the document, or revised the document without changing the
 * fixture. Both are decisions, and both should be visible.
 */

const P = wp.params;

/**
 * Where the site has legitimately moved past the document.
 *
 * `whitepaper-params.json` transcribes the whitepaper, and the whitepaper has
 * not been revised — so `params` and `derived` still say what Draft v0.1 says,
 * and must. When the site changes for a good reason before the document
 * catches up, quietly editing the fixture to match would be exactly the drift
 * this file exists to catch, only running backwards.
 *
 * So the disagreement lives in `pendingRevision`, and these helpers make the
 * tests below hold the site to *that* value instead. The entry is not a note
 * somebody can leave stale: if the site stops matching it, this fails.
 */
type Divergence = { documentSays: number; siteUses: number; tolerance: number; why: string };
// The two `_`-prefixed keys are prose for whoever reads the file; everything
// else is a divergence. Narrow on shape rather than on the key name, so a typo
// in a prefix cannot smuggle a row past the checks below.
const pending: Record<string, Divergence> = Object.fromEntries(
  Object.entries(wp.pendingRevision as Record<string, unknown>).filter(
    (entry): entry is [string, Divergence] =>
      typeof entry[1] === "object" && entry[1] !== null && "siteUses" in entry[1],
  ),
);

/**
 * The value the site should currently produce — the document's, unless a
 * divergence is recorded, in which case that one.
 *
 * `params` entries carry no tolerance and are matched exactly; only `derived`
 * publishes one, because those are rounded figures in prose.
 */
const target = (key: string, fromDocument: { value: number; tolerance?: number }) =>
  key in pending
    ? { value: pending[key].siteUses, tolerance: pending[key].tolerance }
    : { value: fromDocument.value, tolerance: fromDocument.tolerance ?? 0 };

describe("inputs match the whitepaper", () => {
  it("records every pending revision against what the document still says", () => {
    expect(Object.keys(pending).length, "no divergences recorded — has the whitepaper been revised?")
      .toBeGreaterThan(0);
    for (const [key, row] of Object.entries(pending)) {
      // `redemptionMix` holds an object rather than a number, so the lookup is
      // widened through `unknown` and narrowed back here.
      const lookup = (o: unknown) =>
        (o as Record<string, { value: unknown } | undefined>)[key]?.value;
      const documented = lookup(P) ?? lookup(wp.derived);
      expect(row.documentSays, `${key}: pendingRevision disagrees with the transcription`)
        .toBe(documented);
      expect(row.why.length, `${key}: a divergence without a reason is a mistake`)
        .toBeGreaterThan(20);
    }
  });

  it("prices telemetry at the revised tariff, not the 2024 proposal", () => {
    expect(model.given.signalsPerUsd).toBe(P.signalsPerUsd.value);
    // The specific mistake this guards: 1/10,000 instead of 1/150,000.
    expect(e.pricePerSignalUsd).not.toBeCloseTo(0.0001, 8);
  });

  it("samples the four signals once a minute", () => {
    expect(model.given.signals.length).toBe(target("signalCount", P.signalCount).value);
    expect(model.given.samplingIntervalSeconds).toBe(
      P.samplingIntervalSeconds.value,
    );
  });

  it("carries the settled reward rules unchanged", () => {
    expect(model.given.drvPerKm).toBe(P.drvPerKm.value);
    expect(model.given.dailyCapDrv).toBe(P.dailyCapDrv.value);
    expect(model.given.pegDrv).toBe(P.pegDrv.value);
    expect(model.given.pegKrw).toBe(P.pegKrw.value);
    expect(model.given.genesisSeats).toBe(P.genesisSeats.value);
    expect(model.given.genesisRewardMultiplier).toBe(
      P.genesisRewardMultiplier.value,
    );
    expect(model.given.tslmTotalSupply).toBe(P.tslmTotalSupply.value);
  });

  it("carries the assumed inputs unchanged", () => {
    expect(model.assumed.fxKrwPerUsd).toBe(P.fxKrwPerUsd.value);
    expect(model.assumed.avgKmPerMonth).toBe(P.avgKmPerMonth.value);
    expect(model.assumed.partnerCommissionRate).toBe(
      P.partnerCommissionRate.value,
    );
  });

  it("splits redemption the way the whitepaper does", () => {
    const site = model.assumed.redemptionMix;
    const paper = P.redemptionMix.value;
    expect(site.cashBacked).toBeCloseTo(paper.cashBacked, 10);
    expect(site.burnedInApp).toBeCloseTo(paper.burnedInApp, 10);
    expect(site.stakedToTslm).toBeCloseTo(paper.stakedToTslm, 10);
  });
});

describe("derivations reproduce the whitepaper's published figures", () => {
  const near = (actual: number, d: { value: number; tolerance: number }) =>
    expect(Math.abs(actual - d.value)).toBeLessThanOrEqual(d.tolerance);

  it("lands on the per-vehicle API cost the site should currently produce", () => {
    near(e.apiKrwPerMonth, target("apiKrwPerVehicleMonth", wp.derived.apiKrwPerVehicleMonth));
  });

  it("lands on the cohort API cost the site should currently produce", () => {
    near(e.genesisApiKrwPerMonth, target("genesisApiKrwPerMonth", wp.derived.genesisApiKrwPerMonth));
  });

  it("leaves the API at roughly 3% of cash cost, which is the argument", () => {
    near(e.apiShareOfCashCost, target("apiShareOfCashCost", wp.derived.apiShareOfCashCost));
  });
});

describe("the fixture stays honest about itself", () => {
  it("records which whitepaper revision it transcribes", () => {
    expect(wp._source.version).toMatch(/v\d+\.\d+/);
    expect(wp._source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("cites a section for every parameter", () => {
    for (const [key, p] of Object.entries(P)) {
      expect(p.section, `params.${key} has no section reference`).toMatch(/§|Table/);
      expect(p.tag, `params.${key} has no confidence tag`).toBeTruthy();
    }
  });
});
