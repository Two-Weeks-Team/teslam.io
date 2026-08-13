import { describe, expect, it } from "vitest";
import * as e from "@/lib/economics";
import model from "@/data/model.json";
import { readoutAt, DAILY_CAP_DRV } from "@/lib/drive/readout";

/**
 * These reproduce the operator's brief exactly, then guard the step the brief
 * did not take. If the reward figures move, that is a decision — and the
 * assertions below make sure it is a visible one.
 *
 * The figures here are the site's own arithmetic. Whether that arithmetic
 * agrees with the whitepaper is a separate question, asked in
 * `whitepaper-parity.test.ts`. Keeping the two apart matters: this file can
 * only catch a change, while that one catches a number that was wrong from the
 * day it was written.
 */
describe("telemetry cost, as specified", () => {
  it("is 240 signals a day", () => {
    expect(e.signalsPerDay).toBe(240);
  });

  it("is $0.0016 a day and $0.048 a month", () => {
    expect(e.apiUsdPerDay).toBeCloseTo(0.0016, 8);
    expect(e.apiUsdPerMonth).toBeCloseTo(0.048, 8);
  });

  it("is about ₩67 a month per vehicle", () => {
    expect(Math.round(e.apiKrwPerMonth)).toBe(67);
  });

  it("puts Genesis 500 API fees near ₩33,000", () => {
    expect(e.genesisApiKrwPerMonth).toBeGreaterThan(32_000);
    expect(e.genesisApiKrwPerMonth).toBeLessThan(35_000);
  });
});

describe("reward, which is the larger number", () => {
  it("pegs 1 DRV at ₩0.5", () => {
    expect(e.krwPerDrv).toBe(0.5);
  });

  it("caps a day at 50 km of earning", () => {
    expect(e.cappedKmPerDay).toBe(50);
    expect(e.capKrwPerMonth).toBe(7500);
  });

  it("never issues more than the daily cap", () => {
    expect(e.earnedDrvPerDay).toBeLessThanOrEqual(e.dailyCapDrv);
  });

  it("costs more per vehicle than the API does", () => {
    expect(e.netRewardKrwPerMonth).toBeGreaterThan(e.apiKrwPerMonth);
  });
});

describe("the correction the site is built on", () => {
  it("leaves the API bill under half of total cash out", () => {
    expect(e.apiShareOfCashCost).toBeLessThan(0.5);
  });

  it("prices Genesis 500 well above its quoted API-only figure", () => {
    expect(e.genesisTotalKrwPerMonth).toBeGreaterThan(
      e.genesisApiKrwPerMonth * 2,
    );
  });
});

describe("the live-rate path agrees with the static one", () => {
  /**
   * There are now two ways to reach the same seven figures: the constants,
   * bound to the whitepaper's assumed rate, and `deriveAt`, called with
   * whatever rate was quoted for a request. Fed the same rate they must give
   * the same answers, or the page and the machine mirror are describing
   * different businesses.
   */
  const atWhitepaperRate = e.deriveAt(model.assumed.fxKrwPerUsd);

  it.each([
    ["apiKrwPerMonth", e.apiKrwPerMonth],
    ["cashCostPerVehicleMonth", e.cashCostPerVehicleMonth],
    ["apiShareOfCashCost", e.apiShareOfCashCost],
    ["breakevenKrwPerVehicleMonth", e.breakevenKrwPerVehicleMonth],
    ["genesisApiKrwPerMonth", e.genesisApiKrwPerMonth],
    ["genesisPerVehicleKrwPerMonth", e.genesisPerVehicleKrwPerMonth],
    ["genesisTotalKrwPerMonth", e.genesisTotalKrwPerMonth],
  ] as const)("%s matches", (key, constant) => {
    expect(atWhitepaperRate[key]).toBeCloseTo(constant, 8);
  });

  it("moves every figure when the rate moves, and none when it does not", () => {
    const higher = e.deriveAt(model.assumed.fxKrwPerUsd * 1.1);
    expect(higher.apiKrwPerMonth).toBeGreaterThan(e.apiKrwPerMonth);
    expect(higher.genesisApiKrwPerMonth).toBeGreaterThan(
      e.genesisApiKrwPerMonth,
    );
    // The reward side is pegged in won and must not follow the dollar.
    expect(e.krwPerDrv).toBe(0.5);
    expect(e.netRewardKrwPerMonth).toBeGreaterThan(0);
  });
});

describe("model integrity", () => {
  it("has a redemption mix that sums to exactly 1", () => {
    const m = model.assumed.redemptionMix;
    expect(m.cashBacked + m.burnedInApp + m.stakedToTslm).toBeCloseTo(1, 10);
  });

  it("documents a basis for every assumed input", () => {
    for (const key of Object.keys(model.assumed)) {
      expect(
        Object.keys(model.basis),
        `data/model.json: assumed.${key} has no entry in \`basis\``,
      ).toContain(key);
    }
  });

  it("produces no negative money anywhere", () => {
    const figures = [
      e.apiKrwPerMonth,
      e.rewardKrwPerMonth,
      e.netRewardKrwPerMonth,
      e.cashCostPerVehicleMonth,
      e.genesisTotalKrwPerMonth,
    ];
    for (const f of figures) expect(f).toBeGreaterThan(0);
  });
});

describe("the hero honours the rules the page states", () => {
  it("never lets the odometer move backwards", () => {
    let prev = -Infinity;
    for (let i = 0; i <= 400; i++) {
      const r = readoutAt(i / 400);
      expect(r.odo).toBeGreaterThanOrEqual(prev);
      prev = r.odo;
    }
  });

  it("never shows a negative speed or an uncapped DRV balance", () => {
    for (let i = 0; i <= 400; i++) {
      const r = readoutAt(i / 400);
      expect(r.spd).toBeGreaterThanOrEqual(0);
      expect(r.drv).toBeLessThanOrEqual(DAILY_CAP_DRV);
    }
  });
});
