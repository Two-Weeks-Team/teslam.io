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

describe("inputs match the whitepaper", () => {
  it("prices telemetry at the revised tariff, not the 2024 proposal", () => {
    expect(model.given.signalsPerUsd).toBe(P.signalsPerUsd.value);
    // The specific mistake this guards: 1/10,000 instead of 1/150,000.
    expect(e.pricePerSignalUsd).not.toBeCloseTo(0.0001, 8);
  });

  it("samples the four signals once a minute", () => {
    expect(model.given.signals.length).toBe(P.signalCount.value);
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

  it("lands on ₩67 per vehicle per month", () => {
    near(e.apiKrwPerMonth, wp.derived.apiKrwPerVehicleMonth);
  });

  it("lands on ₩33,360 for the whole Genesis 500 cohort", () => {
    near(e.genesisApiKrwPerMonth, wp.derived.genesisApiKrwPerMonth);
  });

  it("leaves the API at roughly 3% of cash cost, which is the argument", () => {
    near(e.apiShareOfCashCost, wp.derived.apiShareOfCashCost);
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
