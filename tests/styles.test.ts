import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The page stylesheets must not fight over a class name.
 *
 * Every sheet in `app/` is imported into one global bundle, so a selector
 * written for one page applies on all of them and the last import wins. That
 * is not theoretical: `.lg` meant "league" in `community.css` and "legal" in
 * `legal.css`, `legal.css` is imported later, and the front page's league
 * section silently inherited `min-height: 100dvh` — about 250px of dead space
 * sitting in the middle of the home page, in production, for as long as nobody
 * measured it.
 *
 * Nothing else could have caught it. Both sheets were correct on their own
 * page, both suites passed, and the rendered HTML was right; only the computed
 * layout was wrong. So the check is on the names themselves.
 */

const SHEETS = ["community", "legal", "genesis", "layout"] as const;

/**
 * Class names a sheet mentions.
 *
 * Scanned rather than parsed. A class token can only appear in a selector, so
 * stripping comments and `url()` — the two places a dot-word shows up without
 * being one — is enough, and it survives nesting and `@media` without a parser
 * that would need maintaining.
 */
function classesIn(file: string): Set<string> {
  const css = readFileSync(`app/${file}.css`, "utf8")
    // Comments hold prose and example selectors.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // `url("/img/hero.avif")` would otherwise contribute `.avif`.
    .replace(/url\([^)]*\)/g, "");

  return new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
}

/**
 * Names that are shared on purpose.
 *
 * `layout.css` holds the site chrome and the shared primitives every page
 * draws with, so overlap with it is the design rather than a collision. What
 * must never overlap is one page sheet with another.
 */
const PAGE_SHEETS = ["community", "legal", "genesis"] as const;

describe("page stylesheets", () => {
  const byFile = new Map(SHEETS.map((f) => [f, classesIn(f)]));

  it("reads every sheet", () => {
    for (const [file, names] of byFile) {
      expect(names.size, `${file}.css parsed to no selectors`).toBeGreaterThan(10);
    }
  });

  it("never defines the same class in two page sheets", () => {
    const clashes: string[] = [];

    for (let i = 0; i < PAGE_SHEETS.length; i += 1) {
      for (let j = i + 1; j < PAGE_SHEETS.length; j += 1) {
        const a = PAGE_SHEETS[i];
        const b = PAGE_SHEETS[j];
        for (const name of byFile.get(a)!) {
          if (byFile.get(b)!.has(name)) clashes.push(`.${name} — ${a}.css and ${b}.css`);
        }
      }
    }

    expect(
      clashes,
      `these class names are defined in more than one page stylesheet, so the ` +
        `last import silently restyles the other page:\n  ${clashes.join("\n  ")}`,
    ).toEqual([]);
  });
});
