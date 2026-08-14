import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/map/routes";
import { home as ko } from "@/content/ko/home";
import { home as en } from "@/content/en/home";

/**
 * The drive routes.
 *
 * This is the one place on the site that draws something shaped like personal
 * movement data, and the site's standing promise — in `/privacy` and on the
 * registration form — is that it never collects a coordinate. The routes are
 * therefore illustrative, and the only thing keeping that honest is the copy
 * saying so.
 *
 * So the load-bearing assertions here are about the labelling, not the
 * geometry. If somebody ever removes the flag, this fails.
 */

describe("the route fixture", () => {
  it("has routes with real geometry", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(3);
    for (const r of ROUTES) {
      // A straight line between two points is what a hand-plotted route looks
      // like. Road geometry has many more points than that.
      expect(r.points.length, `${r.id} is too coarse to be a road`).toBeGreaterThan(15);
      expect(r.km).toBeGreaterThan(0);
    }
  });

  it("stays inside Korea", () => {
    for (const r of ROUTES) {
      for (const [lon, lat] of r.points) {
        expect(lon, `${r.id} has a point outside Korea`).toBeGreaterThan(124);
        expect(lon).toBeLessThan(132);
        expect(lat).toBeGreaterThan(33);
        expect(lat).toBeLessThan(39);
      }
    }
  });

  it("labels both locales", () => {
    for (const r of ROUTES) {
      expect(r.label.ko, `${r.id} ko label`).toBeTruthy();
      expect(r.label.en, `${r.id} en label`).toBeTruthy();
    }
  });
});

describe("what the page says about them", () => {
  it("calls the drives illustrative, in both locales", () => {
    // The flag sits over the map itself, so a screenshot of the drive carries
    // the sentence saying it is not real. Losing it would turn this section
    // into a claim the rest of the site spends its credibility denying.
    expect(ko.routes.flag).toMatch(/예시/);
    expect(ko.routes.flag).toMatch(/아닙니다|아님/);
    expect(en.routes.flag.toLowerCase()).toContain("illustrative");
  });

  it("repeats the no-coordinates promise underneath", () => {
    expect(ko.routes.foot).toMatch(/수집하지 않습니다/);
    expect(en.routes.foot.toLowerCase()).toContain("does not collect");
  });

  it("does not claim the routes belong to anybody", () => {
    for (const t of [ko.routes, en.routes]) {
      const all = JSON.stringify(t);
      expect(all).not.toMatch(/실제 주행 기록|actual trip|real route/i);
    }
  });
});
