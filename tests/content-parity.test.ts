import { describe, expect, it } from "vitest";
import { home as koHome } from "@/content/ko/home";
import { home as enHome } from "@/content/en/home";
import { model as koModel } from "@/content/ko/model";
import { model as enModel } from "@/content/en/model";

/**
 * TypeScript already guarantees the locales share a shape. What it cannot
 * catch is a key copied across and never translated, or left empty.
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

/** Paths where an identical string across locales is correct — proper nouns,
 *  token tickers, and the one nav label that is a brand name. */
const SHARED = new Set([
  "home.nav.cta",
  "home.footer.rights",
  // A unit symbol, not prose.
  "home.league.unit",
  "model.nav.cta",
  "model.tokens.drv.name",
  "model.tokens.tslm.name",
  "model.tokens.drv.full",
  "model.tokens.tslm.full",
  "model.cta.eyebrow",
  "model.footer.rights",
  "model.roadmap.phases.genesis.t",
]);

const MODULES: Array<[string, unknown, unknown]> = [
  ["home", koHome, enHome],
  ["model", koModel, enModel],
];

describe.each(MODULES)("locale parity — %s", (name, ko, en) => {
  it("has no empty strings in either locale", () => {
    walk(ko, en, name, (path, k, e) => {
      expect(k.trim(), `${path}: empty in ko`).not.toBe("");
      // `nav.people` is a Korean counter word with no English equivalent.
      if (path.endsWith(".people")) return;
      expect(e.trim(), `${path}: empty in en`).not.toBe("");
    });
  });

  it("leaves no Korean prose sitting in the English module", () => {
    const hangul = /[가-힣]/;
    walk(ko, en, name, (path, _k, e) => {
      if (SHARED.has(path)) return;
      expect(hangul.test(e), `${path}: Korean text left in the en module`).toBe(
        false,
      );
    });
  });

  it("translates every prose string rather than copying it", () => {
    walk(ko, en, name, (path, k, e) => {
      if (SHARED.has(path)) return;
      // Short tokens (codes, digits, tickers) legitimately match; prose must not.
      if (k.length < 6) return;
      expect(k === e, `${path}: identical in both locales — untranslated?`).toBe(
        false,
      );
    });
  });
});
