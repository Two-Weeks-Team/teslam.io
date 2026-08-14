import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAR_CREDIT } from "@/lib/car-credit";

const CAR = "public/car/model3.bin";

/**
 * Attribution is a licence term, not a courtesy.
 *
 * The body on the Genesis panel is somebody else's mesh under CC BY, and the
 * condition of that licence is that the author is named. The failure mode this
 * guards is precise and entirely plausible: somebody converts a model, sees the
 * car appear, ships it, and never returns to `lib/car-credit.ts` — because the
 * page looks finished either way and nothing complains.
 *
 * So the placeholder is only tolerated while there is no converted car to
 * credit. The moment `public/car/model3.bin` exists, this fails until the
 * author is filled in.
 */
describe("the car's attribution", () => {
  const converted = existsSync(CAR);

  it("names an author whenever there is a downloaded body to credit", () => {
    if (!converted) {
      expect(
        CAR_CREDIT.author,
        "no converted car, so the placeholder is fine — see README, 'The car'",
      ).toBe("—");
      return;
    }
    expect(
      CAR_CREDIT.author.trim(),
      "public/car/model3.bin exists but nobody is credited for it",
    ).not.toBe("—");
    expect(CAR_CREDIT.author.trim().length).toBeGreaterThan(1);
    expect(CAR_CREDIT.href).toMatch(/^https:\/\//);
    expect(CAR_CREDIT.licence).toMatch(/CC|Creative Commons|MIT|Apache|public domain/i);
  });

  it("shows the credit beside the model and in the footer", () => {
    // Both, because a reader who lands on the section from a shared link never
    // sees the footer, and a reader who reads the footer may never reach the
    // section.
    expect(readFileSync("components/genesis/seat-field.tsx", "utf8")).toContain("sfield__credit");
    expect(readFileSync("components/community/footer.tsx", "utf8")).toContain("CAR_CREDIT");
  });

  it("keeps the source model out of the repository", () => {
    // Tens of megabytes of mesh and textures in every clone, to serve a
    // hundred and thirty kilobytes to a reader.
    expect(readFileSync(".gitignore", "utf8")).toContain("/assets/");
  });
});

/**
 * The car has a weight budget too.
 *
 * 287 KB is a lot next to the rest of this site — every image on the page put
 * together is smaller. Three things make it payable, and all three have to
 * stay true or the number stops being defensible:
 *
 *   It is fetched, never bundled, and only when the section scrolls into
 *   view. A reader who stops at the board downloads none of it.
 *
 *   Failing to arrive costs nothing. `loadCar()` resolves null and the
 *   generated car draws instead, so this is an enhancement rather than a
 *   dependency.
 *
 *   It replaces nothing else. There is no photograph of a car on this page and
 *   there was never going to be one — a real Tesla photograph on a site that
 *   says it is unaffiliated is the contradiction the whole footer exists to
 *   avoid.
 *
 * The ceiling is the current size plus a little room to re-convert. Raising it
 * means raising the triangle budget in `scripts/build-car.mjs`, which is a
 * decision, not a side effect.
 */
describe("the converted car's weight", () => {
  it("stays inside its budget", () => {
    if (!existsSync(CAR)) return;
    const kb = statSync(CAR).size / 1024;
    expect(kb).toBeLessThan(320);
  });
});
