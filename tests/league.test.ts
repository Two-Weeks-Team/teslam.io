import { describe, expect, it } from "vitest";
import cm from "@/data/community.json";

/**
 * The leaderboard fixture.
 *
 * The league animates each row from where it sat last week to where it sits
 * now, and it derives last week's position from `rank + delta`. That only works
 * if the deltas describe a movement that could actually have happened.
 *
 * They did not. The original fixture's deltas summed to 4, put two drivers in
 * sixth place and left fourth and fifth empty — decorative arrows that nobody
 * had reason to check while they were only ever printed. A movement that is
 * impossible cannot be played back, so the numbers had to become real before
 * the animation could exist.
 */

const ROWS = cm.leaderboard;

describe("the leaderboard's movement", () => {
  it("ranks the field 1..n with no gaps or ties", () => {
    expect(ROWS.map((r) => r.rank)).toEqual(ROWS.map((_, i) => i + 1));
  });

  it("describes a reordering that could have happened", () => {
    const previous = ROWS.map((r) => r.rank + r.delta);

    // Last week's places must be the same set of places as this week's: every
    // position filled exactly once. Anything else is two drivers in one seat.
    expect([...previous].sort((a, b) => a - b)).toEqual(
      ROWS.map((_, i) => i + 1),
    );
  });

  it("conserves places — every climb is somebody else's fall", () => {
    // A corollary of the above, asserted on its own because it is the cheap
    // check a human can do by eye: the deltas of a real reordering sum to zero.
    expect(ROWS.reduce((sum, r) => sum + r.delta, 0)).toBe(0);
  });

  it("keeps everyone inside the table both weeks", () => {
    for (const r of ROWS) {
      const was = r.rank + r.delta;
      expect(was, `${r.name} came from outside the table`).toBeGreaterThanOrEqual(1);
      expect(was, `${r.name} came from outside the table`).toBeLessThanOrEqual(ROWS.length);
    }
  });
});
