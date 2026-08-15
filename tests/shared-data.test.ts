import { describe, expect, it } from "vitest";
import cm from "@/data/community.json";
import model from "@/data/model.json";
import { home as koHome } from "@/content/ko/home";
import { home as enHome } from "@/content/en/home";
import { REGION_IDS } from "@/lib/genesis";

/**
 * Two defects that both shipped once and are both invisible on the page you
 * happen to be looking at.
 *
 * The first is a display string parked in shared JSON. `data/community.json` is
 * read by both locales, so a Korean label there renders verbatim on /en — and
 * nobody developing in Korean ever sees it. TypeScript cannot help: the field
 * is a string either way.
 *
 * The second is worse than cosmetic. The proof section argues that a leaderboard
 * scored on GPS can be walked and one scored on the odometer cannot. It is very
 * easy — and it happened — to overstate that into "no coordinate ever travels",
 * which is false: the operating model in data/model.json reads latitude and
 * longitude once a minute and /model says so plainly. A site that tells readers
 * their coordinates are not collected while its own specification collects them
 * is not making a wording mistake.
 */

/* ── Shared JSON holds identifiers, not words ─────────────────────────── */

const HANGUL = /[ㄱ-ㆎ가-힣]/;

describe("data shared by both locales carries no display strings", () => {
  it("tier rows are an id and a threshold", () => {
    for (const tier of cm.tiers) {
      expect(Object.keys(tier).sort()).toEqual(["id", "need"]);
      expect(
        HANGUL.test(tier.id),
        `tiers.${tier.id}: an id is not a label — put the name in content/*/home.ts`,
      ).toBe(false);
    }
  });

  it("every tier id has a name and a perk in both locales", () => {
    for (const tier of cm.tiers) {
      for (const [name, t] of [
        ["ko", koHome.ladder.tiers],
        ["en", enHome.ladder.tiers],
      ] as const) {
        const label = t[tier.id as keyof typeof t];
        expect(label, `${name}: no label for tier "${tier.id}"`).toBeTruthy();
        expect(label.name.length).toBeGreaterThan(0);
        expect(label.perk.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Every region in shared data is an id.
   *
   * The first pass at this fixed the nameplate and missed the leaderboard, the
   * rail and the sample regions — which is how /en went on printing 수도권 in
   * the ranking table after the bug was "fixed". So the check is over every
   * region-bearing collection at once rather than the one that was noticed.
   */
  it.each([
    ["nameplate", [cm.nameplate.region]],
    ["leaderboard", cm.leaderboard.map((r) => r.region)],
    ["regions", cm.regions.map((r) => r.id)],
  ])("%s stores region ids, not region names", (_name, values) => {
    for (const v of values) {
      expect(
        REGION_IDS as readonly string[],
        `"${v}" is not a region in lib/genesis, so it cannot be localised`,
      ).toContain(v);
    }
  });

  /**
   * The catch-all.
   *
   * Any *new* Hangul that appears in a field named like a system value is the
   * same bug again. Fields that legitimately hold Korean prose — a sample post
   * title, a member's handle, a ledger line — are named and excluded, so adding
   * one is a deliberate act rather than an oversight.
   */
  it("keeps Hangul out of fields that identify rather than describe", () => {
    const PROSE = new Set([
      "title", "sub", "name", "tag", "author", "ago", "handle", "trim", "_note",
    ]);
    const offenders: string[] = [];

    const walk = (node: unknown, path: string) => {
      if (typeof node === "string") {
        const key = path.split(".").pop()!.replace(/\[\d+\]$/, "");
        if (!PROSE.has(key) && HANGUL.test(node)) offenders.push(`${path} = ${node}`);
        return;
      }
      if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`);
      }
    };

    walk(cm, "cm");
    expect(
      offenders,
      "these look like identifiers holding a Korean label, which renders verbatim on /en",
    ).toEqual([]);
  });
});

/* ── The proof section may not outrun the operating model ─────────────── */

describe("the coordinate claim matches what the model collects", () => {
  const collectsCoordinates =
    model.given.signals.includes("latitude") ||
    model.given.signals.includes("longitude");

  /**
   * Phrasings that assert coordinates are absent rather than merely unused for
   * scoring. Kept blunt on purpose: a false positive costs one rewritten line,
   * a miss tells every reader something untrue about location data.
   *
   * The direction of this guard has now flipped, which it always anticipated.
   * While the model read latitude and longitude every sixty seconds, the copy
   * was allowed to say only that coordinates were not the *basis* of the score
   * — saying they were absent would have been false. Tesla separated
   * `vehicle_location` out of `vehicle_device_data` in late 2024, and the
   * odometer sits in `Vehicle State`, so the site can now decline location
   * outright. It does. The stronger sentence became available by changing what
   * the system does, which is the only honest way to earn one.
   */
  const DENIES_COLLECTION = [
    /좌표가 아니라 숫자 하나만/,
    /좌표(는|를)?\s*(받|수집|전송|전달)(지|하지)\s*않/,
    /never a coordinate/i,
    /no coordinates? (is|are) (ever )?(sent|collected|transmitted)/i,
    /without (sending|collecting) (any )?coordinates/i,
  ];

  it.each([
    ["ko", koHome.proof],
    ["en", enHome.proof],
  ])("%s: may only claim coordinates are absent while the model actually declines them", (name, proof) => {
    const body = JSON.stringify(proof);
    const denies = DENIES_COLLECTION.some((rule) => rule.test(body));

    if (collectsCoordinates) {
      expect(
        denies,
        `${name} proof section says coordinates are not collected, but data/model.json collects ${model.given.signals.join(", ")} every ${model.given.samplingIntervalSeconds}s`,
      ).toBe(false);
    } else {
      // Not required to make the claim — but if the model declines location and
      // the copy still hedges, the site is underselling something true, and a
      // later reader has no way to tell the hedge from a limitation.
      expect(
        model.given.signals.some((s) => /lat|lon|gps|location/i.test(s)),
        "no signal may name a coordinate while the copy claims none are collected",
      ).toBe(false);
    }
  });
});
