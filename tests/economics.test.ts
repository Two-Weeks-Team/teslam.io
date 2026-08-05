import { describe, expect, it } from "vitest";
import * as e from "@/lib/economics";
import model from "@/data/model.json";
import { readoutAt, DAILY_CAP_DRV } from "@/lib/drive/readout";

/**
 * These reproduce the operator's brief exactly, then guard the step the brief
 * did not take. If someone edits `data/model.json` and the API-cost figures
 * stop matching the specification, that is a mistake. If the reward figures
 * move, that is a decision — and the assertions below make sure it is a
 * visible one.
 */
describe("telemetry cost, as specified", () => {
  it("is 240 signals a day", () => {
    expect(e.signalsPerDay).toBe(240);
  });

  it("is $0.024 a day and $0.72 a month", () => {
    expect(e.apiUsdPerDay).toBeCloseTo(0.024, 6);
    expect(e.apiUsdPerMonth).toBeCloseTo(0.72, 6);
  });

  it("is about ₩1,000 a month per vehicle", () => {
    expect(Math.round(e.apiKrwPerMonth)).toBe(1001);
  });

  it("puts Genesis 500 API fees near ₩500,000", () => {
    expect(e.genesisApiKrwPerMonth).toBeGreaterThan(480_000);
    expect(e.genesisApiKrwPerMonth).toBeLessThan(520_000);
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
