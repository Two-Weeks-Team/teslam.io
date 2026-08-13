import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getContent, getModel } from "@/lib/i18n";
import community from "@/data/community.json";

/**
 * Comments are stripped first. The rules below are documented in the CSS
 * itself, banned hex values and all, and a scan that did not strip them would
 * fail on its own explanation.
 */
const css = ["app/globals.css", "app/layout.css", "app/community.css"]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");

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

  it("declares each surface's accent exactly once", () => {
    expect(css, "the model page's accent").toContain("--color-volt: #cbff3c");
    expect(css, "the community page's accent").toContain("--mint: #00c2a8");
  });
});

describe("required disclosure", () => {
  for (const locale of ["ko", "en"] as const) {
    it(`${locale}: states it is not affiliated with Tesla`, () => {
      for (const d of [
        getContent(locale).footer.disclaimerTrademark,
        getModel(locale).footer.disclaimerTrademark,
      ]) {
        const s = d.toLowerCase();
        expect(s).toContain("tesla");
        expect(
          s.includes("not affiliated") || s.includes("아닌") || s.includes("아닙"),
        ).toBe(true);
      }
    });

    it(`${locale}: states no token has been issued`, () => {
      for (const d of [
        getContent(locale).footer.disclaimerFinancial,
        getModel(locale).footer.disclaimerFinancial,
      ]) {
        expect(d).toMatch(/DRV/);
        expect(d).toMatch(/TSLM/);
      }
    });
  }
});

/**
 * The front page currently shows invented posts, ranks and balances. That is
 * fine as a preview and unacceptable as an unlabelled claim, so the label and
 * the data are wired to the same flag: turning the sample data on without the
 * notice — or shipping the notice copy empty — fails the build.
 */
describe("sample content is labelled", () => {
  it("keeps the preview flag and the preview copy in step", () => {
    if (!community.isPreview) return;
    for (const locale of ["ko", "en"] as const) {
      const p = getContent(locale).preview;
      expect(p.tag.trim().length, `${locale}: preview tag is empty`).toBeGreaterThan(0);
      expect(p.body.trim().length, `${locale}: preview body is empty`).toBeGreaterThan(20);
    }
  });

  it("says in the data file itself that the content is sample", () => {
    expect(community._note.toLowerCase()).toContain("sample");
  });

  /**
   * The page is no longer all one thing.
   *
   * Seats, the regional split and the watcher count are measurements now; posts,
   * ranks and wallet entries are still invented. A notice that lumps them
   * together was honest while everything was invented and is misleading now, so
   * the copy has to name both halves and the marks have to exist for each.
   */
  it("names both halves rather than calling the page one thing", () => {
    for (const locale of ["ko", "en"] as const) {
      const p = getContent(locale).preview;
      expect(p.realLabel.trim().length, `${locale}: no label for real figures`)
        .toBeGreaterThan(0);
      expect(p.sampleLabel.trim().length, `${locale}: no label for sample content`)
        .toBeGreaterThan(0);
      expect(
        p.realLabel.trim() === p.sampleLabel.trim(),
        `${locale}: the two labels are identical, so they distinguish nothing`,
      ).toBe(false);

      // The banner must mention the real side too, not only the sample side.
      const mentionsReal =
        locale === "ko"
          ? /실제 수치|실제 값/.test(p.body)
          : /real figure/i.test(p.body);
      expect(
        mentionsReal,
        `${locale}: the notice does not say which figures are real`,
      ).toBe(true);
    }
  });
});

describe("claims", () => {
  const strings = JSON.stringify([
    getContent("ko"),
    getContent("en"),
    getModel("ko"),
    getModel("en"),
  ]);

  it("promises no returns and no guarantees", () => {
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
    for (const f of ["content/ko/home.ts", "content/ko/model.ts"]) {
      const content = readFileSync(f, "utf8");
      expect(content, `${f}: hardcoded won figure`).not.toMatch(/\d{1,3},\d{3}\s*원/);
      expect(content, `${f}: hardcoded dollar figure`).not.toMatch(/\$\d/);
    }
  });
});
