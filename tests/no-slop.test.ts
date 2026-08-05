import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getContent } from "@/lib/i18n";

/**
 * Comments are stripped first. The rules below are documented in the CSS
 * itself, banned hex values and all, and a scan that did not strip them would
 * fail on its own explanation.
 */
const css = (
  readFileSync("app/globals.css", "utf8") + readFileSync("app/layout.css", "utf8")
).replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Design and positioning rules that a redesign must not quietly undo.
 *
 * The trademark rule is the important one: this project's name is one letter
 * from a car maker's, so nothing in the palette or the copy may imply it is a
 * first-party surface.
 */
describe("palette", () => {
  it("uses no indigo/violet — the 2026 AI-slop tell", () => {
    const banned = [
      "#6366f1",
      "#6d28d9",
      "#7c3aed",
      "#8b5cf6",
      "#a78bfa",
      "#4f46e5",
    ];
    for (const hex of banned) {
      expect(css.toLowerCase(), `banned colour ${hex}`).not.toContain(hex);
    }
  });

  it("uses no Tesla red, so the site cannot read as first-party", () => {
    for (const hex of ["#e82127", "#e31937", "#cc0000"]) {
      expect(css.toLowerCase(), `Tesla-adjacent red ${hex}`).not.toContain(hex);
    }
  });

  it("keeps a single accent declared once", () => {
    expect(css).toContain("--color-volt: #cbff3c");
  });
});

describe("required disclosure", () => {
  for (const locale of ["ko", "en"] as const) {
    it(`${locale}: states it is not affiliated with Tesla`, () => {
      const d = getContent(locale).footer.disclaimerTrademark.toLowerCase();
      expect(d).toContain("tesla");
      expect(
        d.includes("not affiliated") || d.includes("아닌") || d.includes("아닙"),
      ).toBe(true);
    });

    it(`${locale}: states no token has been issued`, () => {
      const d = getContent(locale).footer.disclaimerFinancial;
      expect(d).toMatch(/DRV/);
      expect(d).toMatch(/TSLM/);
    });
  }
});

describe("claims", () => {
  const strings = JSON.stringify([getContent("ko"), getContent("en")]);

  it("promises no returns and no guarantees", () => {
    // Marketing verbs that would turn an operating model into an offer.
    const banned = [
      "guaranteed return",
      "risk-free",
      "원금 보장",
      "수익 보장을",
      "확정 수익",
      "무조건 수익",
    ];
    for (const phrase of banned) {
      expect(strings, `banned claim: ${phrase}`).not.toContain(phrase);
    }
  });

  it("hardcodes no won or dollar figures in the copy", () => {
    // Every figure must come from lib/economics. A number typed into a content
    // module is one that can silently disagree with the model.
    const content = readFileSync("content/ko/home.ts", "utf8");
    expect(content).not.toMatch(/\d{1,3},\d{3}\s*원/);
    expect(content).not.toMatch(/\$\d/);
  });
});
