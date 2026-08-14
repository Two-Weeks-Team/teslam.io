import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modeFor, SHOWCASE, type Capabilities, type Capability } from "@/lib/showcase";
import { BOARDS, BOARD_IDS, LIMITS, countChars, handleProblem, isBoard, isSort } from "@/lib/board";

/**
 * The switch, and the contract it rests on.
 *
 * `NEXT_PUBLIC_SHOWCASE` decides one thing only: whether a section with no data
 * source behind it may draw invented content. What is real is decided by the
 * API, which publishes its own capabilities — so that shipping a backend is
 * what promotes a section, rather than somebody remembering to edit a constant
 * in this repository afterwards.
 *
 * The failure this guards against is the quiet one. A section that keeps
 * calling itself sample content after its data became real is merely
 * embarrassing; a section that draws invented numbers with the switch off,
 * unlabelled, on a page that says everything on it is measured, is the thing
 * the whole scheme exists to prevent.
 */

const caps = (live: Partial<Record<Capability, boolean>>): Capabilities => ({
  live: {
    seats: false,
    board: false,
    league: false,
    quests: false,
    badges: false,
    wallet: false,
    garage: false,
    shop: false,
    ...live,
  },
  counts: { posts: 0 },
  reached: true,
});

describe("what a section draws", () => {
  it("draws real data whenever the API has the source, switch or no switch", () => {
    expect(modeFor("board", caps({ board: true }))).toBe("real");
    expect(modeFor("league", caps({ league: true }))).toBe("real");
  });

  it("never draws invented content as if it were real", () => {
    // The one combination that must be impossible: a live source and a
    // "sample" verdict, or vice versa.
    for (const cap of ["board", "league", "wallet"] as Capability[]) {
      expect(modeFor(cap, caps({ [cap]: true }))).toBe("real");
      expect(modeFor(cap, caps({}))).not.toBe("real");
    }
  });

  it("falls back to sample only while the switch allows it", () => {
    const verdict = modeFor("league", caps({}));
    expect(verdict).toBe(SHOWCASE ? "sample" : "hidden");
  });

  it("hides rather than inventing when an unreachable API leaves everything unknown", () => {
    const unreachable: Capabilities = { ...caps({}), reached: false };
    for (const cap of ["board", "league", "quests"] as Capability[]) {
      expect(
        modeFor(cap, unreachable),
        `${cap} claimed a real source while the API was unreachable`,
      ).not.toBe("real");
    }
  });
});

/**
 * The front page has to route every capability somewhere.
 *
 * A section added to the page and forgotten here renders unconditionally, which
 * is exactly the state the switch was built to end. Checked by reading the
 * source rather than by rendering, because the failure is a missing line and a
 * render test would pass while it was missing.
 */
describe("the front page consults the capabilities for every gated section", () => {
  const home = readFileSync("components/pages/home.tsx", "utf8");

  it.each(["league", "quests", "badges", "garage", "wallet", "shop", "board"])(
    "gates on %s",
    (cap) => {
      expect(home, `home.tsx never asks about "${cap}"`).toContain(`"${cap}"`);
    },
  );

  it("puts the rehearsed playback behind the same switch", () => {
    const transport = readFileSync("components/community/demo-transport.tsx", "utf8");
    expect(
      transport,
      "playback is invented content in motion and must share the switch",
    ).toContain("SHOWCASE");
  });
});

/* ── the board's shared vocabulary ────────────────────────────────────── */

describe("board identifiers and limits", () => {
  it("carries no display string into shared data", () => {
    for (const b of BOARDS) {
      expect(/[ㄱ-ㆎ가-힣]/.test(b.id), `board id "${b.id}" is a label, not an id`).toBe(false);
      expect(b.ko.length).toBeGreaterThan(0);
      expect(b.en.length).toBeGreaterThan(0);
      // A board whose two locales are the same string is one somebody forgot
      // to translate — except where the name is a proper noun in both.
      if (!["FSD"].includes(b.en)) expect(b.ko).not.toBe(b.en);
    }
  });

  it("accepts only the boards and sorts it published", () => {
    for (const id of BOARD_IDS) expect(isBoard(id)).toBe(true);
    for (const bad of ["", "all", "Free", 7, null, undefined]) expect(isBoard(bad)).toBe(false);
    expect(isSort("hot")).toBe(true);
    expect(isSort("newest")).toBe(false);
  });

  it("counts characters the way a writer does, not the way UTF-16 does", () => {
    // The bug this pins: `"가".length` is 1 and an emoji's is 2, so a length
    // check charges an emoji double and can split a surrogate pair.
    expect(countChars("가나다")).toBe(3);
    expect(countChars("🚗🚗")).toBe(2);
    expect("🚗🚗".length).toBe(4);
  });

  it("checks handles rather than silently rewriting them", () => {
    expect(handleProblem("광교전비장인")).toBeNull();
    expect(handleProblem("driver_01")).toBeNull();
    expect(handleProblem("a")).toBe("length");
    expect(handleProblem("a".repeat(LIMITS.handle.max + 1))).toBe("length");
    // Stripping these would hand somebody a name they did not choose, and two
    // different inputs could strip to the same one — a collision on a column
    // the board treats as an identity.
    expect(handleProblem("has space")).toBe("charset");
    expect(handleProblem("<script>")).toBe("charset");
    expect(handleProblem(42)).toBe("type");
  });
});
