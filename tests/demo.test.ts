import { describe, expect, it } from "vitest";
import { DEMO_DURATION, PHASES, demoScript, demoTimeline } from "@/lib/demo";
import { REGIONS, SEATS } from "@/lib/genesis";
import { home as ko } from "@/content/ko/home";
import { home as en } from "@/content/en/home";

/**
 * The rehearsed run.
 *
 * This is the one feature on the site that puts invented numbers on the board
 * on purpose, so the tests are mostly about the invention staying inside its
 * fence: it fills exactly the cohort and no more, it never lands a seat before
 * the clock starts, and the copy that says it is a simulation exists in both
 * locales and cannot quietly go missing.
 */

describe("the script", () => {
  const events = demoScript();

  it("fills the cohort exactly once", () => {
    expect(events).toHaveLength(SEATS);
    expect(new Set(events.map((e) => e.seat)).size).toBe(SEATS);
    expect(Math.min(...events.map((e) => e.seat))).toBe(1);
    expect(Math.max(...events.map((e) => e.seat))).toBe(SEATS);
  });

  it("numbers seats in the order they arrive", () => {
    // Seat 1 means the first person to confirm. If the ordinals did not follow
    // the clock, the car would light out of order and the number would be a
    // label rather than a position.
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at);
      expect(events[i].seat).toBe(events[i - 1].seat + 1);
    }
  });

  it("lands every seat inside the run, never before it starts", () => {
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThanOrEqual(PHASES[PHASES.length - 1].until);
    }
  });

  it("only uses regions the form offers", () => {
    const known = new Set(REGIONS.map((r) => r.id));
    for (const e of events) expect(known.has(e.region)).toBe(true);
  });

  it("does not arrive at a metronome", () => {
    /*
     * Real registration comes in bursts. Evenly spaced arrivals would read as a
     * progress bar wearing a costume, and would also quietly misrepresent what
     * growth looks like — so the gaps must actually vary.
     */
    const gaps = events.slice(1).map((e, i) => e.at - events[i].at);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const spread = Math.sqrt(
      gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length,
    );
    expect(spread).toBeGreaterThan(mean * 0.3);
  });

  it("is the same run every time", () => {
    // Seeded, not random: an operator has to be able to rehearse what a visitor
    // will see, and a screenshot has to be reproducible.
    const again = demoScript();
    expect(again.map((e) => [e.at, e.region])).toEqual(
      events.map((e) => [e.at, e.region]),
    );
  });
});

describe("the timeline", () => {
  const { at } = demoTimeline();

  it("shows an empty board before the first arrival", () => {
    const start = at(-1);
    expect(start.taken).toBe(0);
    expect(start.justTook).toBeNull();
    expect(Object.values(start.byRegion).every((n) => n === 0)).toBe(true);
  });

  it("never exceeds the cohort", () => {
    for (const ms of [0, 5_000, 20_000, 36_000, DEMO_DURATION, DEMO_DURATION * 3]) {
      const frame = at(ms);
      expect(frame.taken).toBeLessThanOrEqual(SEATS);
      const summed = Object.values(frame.byRegion).reduce((a, b) => a + b, 0);
      expect(summed, `regions disagree with the total at ${ms}ms`).toBe(frame.taken);
    }
  });

  it("finishes full", () => {
    expect(at(DEMO_DURATION).taken).toBe(SEATS);
    expect(at(DEMO_DURATION).done).toBe(true);
  });

  it("only advances", () => {
    let previous = 0;
    for (let ms = 0; ms <= DEMO_DURATION; ms += 250) {
      const { taken } = at(ms);
      expect(taken).toBeGreaterThanOrEqual(previous);
      previous = taken;
    }
  });
});

describe("what the page says while it runs", () => {
  it("has simulation copy in both locales", () => {
    for (const [name, t] of [
      ["ko", ko],
      ["en", en],
    ] as const) {
      expect(t.demo.play, `${name} play label`).toBeTruthy();
      expect(t.demo.stop, `${name} stop label`).toBeTruthy();
      // The flag stays up for the whole run. Without it, a visitor arriving
      // mid-playback reads fabricated figures as measurements.
      expect(t.demo.flag, `${name} running flag`).toBeTruthy();
      expect(t.preview.demoBody, `${name} banner replacement`).toBeTruthy();
    }
  });

  it("never calls the simulated figures real", () => {
    expect(ko.demo.flag).toContain("실제");
    expect(ko.demo.flag).toMatch(/아닙니다|아님/);
    expect(en.demo.flag.toLowerCase()).toContain("not real");
  });

  it("replaces the banner's claim rather than leaving it standing", () => {
    // The resting banner says the seat count and the regional split are real.
    // That sentence is false while the script runs, so the demo copy has to
    // contradict it explicitly rather than sit quietly beside it.
    expect(ko.preview.demoBody).toMatch(/실제 등록이 아닙니다/);
    expect(en.preview.demoBody.toLowerCase()).toContain("not real registrations");
  });
});
