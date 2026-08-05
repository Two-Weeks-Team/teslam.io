import { describe, expect, it } from "vitest";
import { home as ko } from "@/content/ko/home";
import { home as en } from "@/content/en/home";

/**
 * TypeScript already guarantees the two locales share a shape. What it cannot
 * catch is a key that was copied across and never translated, or one that was
 * left as an empty string.
 */
function walk(
  a: unknown,
  b: unknown,
  path: string,
  onLeaf: (path: string, ko: string, en: string) => void,
): void {
  if (typeof a === "string" && typeof b === "string") {
    onLeaf(path, a, b);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(b.length, `${path}: array length differs between locales`).toBe(
      a.length,
    );
    a.forEach((item, i) => walk(item, b[i], `${path}[${i}]`, onLeaf));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of Object.keys(a as object)) {
      walk(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
        onLeaf,
      );
    }
  }
}

describe("locale parity", () => {
  it("has no empty strings in either locale", () => {
    walk(ko, en, "home", (path, k, e) => {
      expect(k.trim(), `${path}: empty in ko`).not.toBe("");
      expect(e.trim(), `${path}: empty in en`).not.toBe("");
    });
  });

  it("leaves no Korean prose sitting in the English module", () => {
    const hangul = /[가-힣]/;
    // Paths where an identical string across locales is correct.
    const shared = new Set([
      "home.nav.cta",
      "home.tokens.drv.name",
      "home.tokens.tslm.name",
      "home.tokens.drv.full",
      "home.tokens.tslm.full",
      "home.cta.eyebrow",
      "home.footer.rights",
      // A proper noun. Translating the cohort's name would make the Korean and
      // English pages describe two different programmes.
      "home.roadmap.phases.genesis.t",
    ]);

    walk(ko, en, "home", (path, _k, e) => {
      if (shared.has(path)) return;
      expect(hangul.test(e), `${path}: Korean text left in the en module`).toBe(
        false,
      );
    });
  });

  it("translates every prose string rather than copying it", () => {
    const shared = new Set([
      "home.nav.cta",
      "home.tokens.drv.name",
      "home.tokens.tslm.name",
      "home.tokens.drv.full",
      "home.tokens.tslm.full",
      "home.cta.eyebrow",
      "home.footer.rights",
      // A proper noun. Translating the cohort's name would make the Korean and
      // English pages describe two different programmes.
      "home.roadmap.phases.genesis.t",
    ]);

    walk(ko, en, "home", (path, k, e) => {
      if (shared.has(path)) return;
      // Short tokens (codes, digits) legitimately match; prose must not.
      if (k.length < 6) return;
      expect(k === e, `${path}: identical in both locales — untranslated?`).toBe(
        false,
      );
    });
  });
});
