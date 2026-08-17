import { describe, expect, it } from "vitest";
import model from "@/data/model.json";
import {
  MILES_TO_KM,
  accrualDay,
  accrue,
  milesToKm,
  wasRejected,
  type Reading,
} from "@/cloudflare/lib/accrual";

/**
 * The accrual rules, tested by attacking them.
 *
 * The passing cases here are the easy half. What this file is actually for is
 * the rejections: the site tells readers that a record cannot be rewound, and
 * that claim is only worth what the refusals below are worth. A test suite
 * that proves ten kilometres earns a hundred DRV proves nothing anybody was
 * worried about.
 */

const { given } = model;
const HOUR = 3_600_000;

const at = (id: string, minutes: number, km: number): Reading => ({
  id,
  recordedAt: Date.UTC(2026, 7, 15, 0, 0, 0) + minutes * 60_000,
  odometerKm: km,
});

describe("miles, which is the unit Tesla actually sends", () => {
  it("converts on the way in", () => {
    expect(MILES_TO_KM).toBe(1.609344);
    expect(milesToKm(100)).toBeCloseTo(160.9344, 6);
  });

  /**
   * The failure this guards is silent and expensive: reading Tesla's miles as
   * kilometres understates every distance by 38%, and nothing crashes. Members
   * would simply earn less than the site promises, for as long as nobody
   * checked.
   */
  it("does not quietly treat a mile as a kilometre", () => {
    expect(milesToKm(1)).not.toBe(1);
    expect(milesToKm(1)).toBeGreaterThan(1.6);
  });
});

describe("the daily boundary", () => {
  it("is Seoul's, not the server's", () => {
    // 15:30 UTC is already the 16th in Seoul.
    expect(accrualDay(Date.UTC(2026, 7, 15, 15, 30))).toBe("2026-08-16");
    expect(accrualDay(Date.UTC(2026, 7, 15, 14, 30))).toBe("2026-08-15");
  });
});

describe("ordinary driving", () => {
  it("pays the model's rate", () => {
    const r = accrue(at("a", 0, 1000), at("b", 30, 1030), 0);
    expect(wasRejected(r)).toBe(false);
    if (wasRejected(r)) return;
    expect(r.deltaKm).toBeCloseTo(30, 6);
    expect(r.drv).toBe(30 * given.drvPerKm);
    expect(r.accrualDay).toBe("2026-08-15");
  });

  it("floors rather than rounds, so a fraction never pays a whole DRV", () => {
    const r = accrue(at("a", 0, 1000), at("b", 10, 1000.19), 0);
    if (wasRejected(r)) throw new Error("should have accrued");
    // 0.19 km × 10 = 1.9 → 1
    expect(r.drv).toBe(1);
  });
});

describe("the cap", () => {
  it("stops at the daily limit", () => {
    const r = accrue(at("a", 0, 1000), at("b", 120, 1200), 0);
    if (wasRejected(r)) throw new Error("should have accrued");
    expect(r.drvUncapped).toBe(2000);
    expect(r.drv).toBe(given.dailyCapDrv);
  });

  /**
   * The uncapped figure is kept on purpose. The site promises a cap, which is
   * a limit somebody can see acting on them — not a quiet disappearance of
   * kilometres they drove.
   */
  it("records what the distance would have earned", () => {
    const r = accrue(at("a", 0, 1000), at("b", 120, 1200), 0);
    if (wasRejected(r)) throw new Error("should have accrued");
    expect(r.drvUncapped).toBeGreaterThan(r.drv);
  });

  it("counts what is already earned today", () => {
    const r = accrue(at("a", 0, 1000), at("b", 30, 1030), given.dailyCapDrv - 100);
    if (wasRejected(r)) throw new Error("should have accrued");
    expect(r.drv).toBe(100);
  });

  it("pays nothing once the cap is reached, and does not go negative", () => {
    const r = accrue(at("a", 0, 1000), at("b", 30, 1030), given.dailyCapDrv);
    if (wasRejected(r)) throw new Error("should have accrued");
    expect(r.drv).toBe(0);
  });
});

/* ── The half that matters ───────────────────────────────────────────── */

describe("what it refuses", () => {
  it("refuses an odometer that went backwards", () => {
    const r = accrue(at("a", 0, 1000), at("b", 30, 990), 0);
    expect(r).toEqual({ rejected: "not-increasing" });
  });

  it("refuses a repeated reading", () => {
    const r = accrue(at("a", 0, 1000), at("b", 30, 1000), 0);
    expect(r).toEqual({ rejected: "not-increasing" });
  });

  /**
   * Two frames stamped the same millisecond divide by zero and produce
   * Infinity, which is not greater than nothing and would have passed a naive
   * speed check. Worth its own case because the arithmetic is what fails, not
   * the rule.
   */
  it("refuses two readings from the same instant", () => {
    const a = at("a", 0, 1000);
    const b = { ...at("b", 0, 1050), recordedAt: a.recordedAt };
    expect(accrue(a, b, 0)).toEqual({ rejected: "implausible-speed" });
  });

  it("refuses a distance no car covered in the time", () => {
    // 500 km in one hour.
    const r = accrue(at("a", 0, 1000), at("b", 60, 1500), 0);
    expect(r).toEqual({ rejected: "implausible-speed" });
  });

  it("allows a genuinely fast drive", () => {
    // 200 km in an hour is legal nowhere and physical everywhere.
    const r = accrue(at("a", 0, 1000), at("b", 60, 1200), 0);
    expect(wasRejected(r)).toBe(false);
  });

  /**
   * A long silence is not a long drive. The distance across it was covered by
   * trips that were never streamed, and crediting it would be crediting a
   * guess — which is exactly what a member could arrange by disconnecting.
   */
  it("refuses to settle a month of silence in one payment", () => {
    const from = at("a", 0, 1000);
    const to: Reading = {
      id: "b",
      recordedAt: from.recordedAt + 30 * 24 * HOUR,
      odometerKm: 3000,
    };
    expect(accrue(from, to, 0)).toEqual({ rejected: "gap-too-long" });
  });

  it("survives an outage inside the window", () => {
    const from = at("a", 0, 1000);
    const to: Reading = {
      id: "b",
      recordedAt: from.recordedAt + 3 * 24 * HOUR,
      odometerKm: 1300,
    };
    expect(wasRejected(accrue(from, to, 0))).toBe(false);
  });

  it("refuses movement below the odometer's own resolution", () => {
    const r = accrue(at("a", 0, 1000), at("b", 5, 1000.01), 0);
    expect(r).toEqual({ rejected: "below-resolution" });
  });
});

/* ── Replay, which is the attack the site's claim is about ────────────── */

describe("replay", () => {
  /**
   * The database refuses a repeated interval — `UNIQUE (vehicle_id,
   * to_reading_id)` in 0003 — and that is the guarantee. This checks the
   * weaker property that belongs to this file: replaying the *arithmetic* is
   * deterministic, so a retry after a crash computes the identical row rather
   * than a slightly different one that would slip past a uniqueness check on
   * some other column.
   */
  it("computes the same row twice, so a retry collides rather than diverges", () => {
    const from = at("a", 0, 1000);
    const to = at("b", 30, 1030);
    expect(accrue(from, to, 0)).toEqual(accrue(from, to, 0));
  });

  it("cannot be replayed into more DRV by reversing the pair", () => {
    const from = at("a", 0, 1000);
    const to = at("b", 30, 1030);
    expect(accrue(to, from, 0)).toEqual({ rejected: "not-increasing" });
  });
});
