import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The photography, and its budget.
 *
 * Images are the asset that grows by accident: someone re-exports one at full
 * quality, nobody notices for a month, and the page that used to load on a
 * subway connection stops doing so. A number in a test is the cheapest way to
 * find out on the day it happens rather than in an analytics dashboard later.
 *
 * The source PNGs are deliberately not in the repository. They came back from
 * the generator at over two megabytes each and have no use once converted —
 * keeping them would put four and a half megabytes into every clone to serve a
 * hundred kilobytes to a reader.
 */

const DIR = "public/img";

/** Per-file ceilings, in kilobytes. Raise one only with a reason. */
const BUDGET: Record<string, number> = {
  "hero.avif": 90,
  "hero.webp": 90,
  "seat.avif": 120,
  "seat.webp": 120,
  "og.webp": 80,
};

const files = readdirSync(DIR);
const kb = (f: string) => statSync(join(DIR, f)).size / 1024;

describe("photography", () => {
  it("ships every image the stylesheets ask for", () => {
    for (const name of Object.keys(BUDGET)) {
      expect(files, `${name} is missing`).toContain(name);
    }
  });

  it.each(Object.entries(BUDGET))("%s stays under %i KB", (name, limit) => {
    expect(Math.round(kb(name))).toBeLessThanOrEqual(limit);
  });

  it("offers AVIF beside every WebP that has one", () => {
    // The stylesheets declare AVIF first in `image-set()`; a missing file there
    // is a silent fallback rather than an error, so it is checked here.
    for (const f of files.filter((f) => f.endsWith(".avif"))) {
      expect(files).toContain(f.replace(".avif", ".webp"));
    }
  });

  it("keeps the multi-megabyte generator output out of the repository", () => {
    const heavy = files.filter((f) => f.endsWith(".png") && kb(f) > 500);
    expect(heavy, "raw generator PNGs should not be committed").toEqual([]);
  });
});
