/**
 * The vocabulary of a Genesis 500 registration.
 *
 * This module is imported by both the Next front end and the Cloudflare
 * Worker. That is the point: a region list defined twice is a region list that
 * will disagree, and the site already has the scar — `data/community.json`
 * ships four regions while its own leaderboard uses names from a different,
 * five-entry list.
 *
 * Nothing here touches a runtime API, so it loads unchanged in Node, in the
 * browser and in workerd.
 */

/** The cohort. Fixed by the whitepaper, §7.5. */
export const SEATS = 500;

/**
 * Seven regions rather than the four in the sample data.
 *
 * Four lets Seoul swallow the map — the capital area holds most Korean Teslas,
 * so a coarse split renders as one hot blob and six empty ones. Seven is the
 * conventional Korean grouping, matches province boundaries in the TopoJSON,
 * and is the granularity at which the whitepaper's density argument (§10.1)
 * can actually be read: a league needs faces you recognise and a redemption
 * partner needs to be somewhere you already drive.
 */
export const REGIONS = [
  { id: "capital", ko: "수도권", en: "Seoul Capital Area" },
  { id: "gangwon", ko: "강원", en: "Gangwon" },
  { id: "chungcheong", ko: "대전·충청", en: "Daejeon & Chungcheong" },
  { id: "daegu", ko: "대구·경북", en: "Daegu & Gyeongbuk" },
  { id: "busan", ko: "부산·울산·경남", en: "Busan, Ulsan & Gyeongnam" },
  { id: "jeolla", ko: "광주·전라", en: "Gwangju & Jeolla" },
  { id: "jeju", ko: "제주", en: "Jeju" },
] as const;

export type RegionId = (typeof REGIONS)[number]["id"];

/**
 * The one place a region id becomes words.
 *
 * Lives here, beside the list, because every component that showed a region
 * used to carry its own Korean string — and each of those rendered verbatim on
 * /en. Falling back to the id rather than throwing keeps an unknown region
 * visible instead of blanking a row, which is what makes the mistake findable.
 *
 * Typed structurally rather than against `Locale` so the Worker, which imports
 * this module, does not pull in the site's content bundle.
 */
export const regionLabel = (locale: "ko" | "en", id: string): string =>
  REGIONS.find((r) => r.id === id)?.[locale] ?? id;

export const MODELS = [
  "Model 3",
  "Model Y",
  "Model S",
  "Model X",
  "Cybertruck",
] as const;

export type Model = (typeof MODELS)[number];

/**
 * Trims are self-reported and never verified — vehicle binding happens later,
 * through Tesla's own authorisation. A closed list is still better than free
 * text: it keeps the cohort readable without inviting anyone to type a VIN
 * into a field that was not asked for.
 */
export const TRIMS: Record<Model, readonly string[]> = {
  "Model 3": ["RWD", "Long Range", "Performance", "하이랜드"],
  "Model Y": ["RWD", "Long Range", "Performance", "주니퍼"],
  "Model S": ["Dual Motor", "Plaid"],
  "Model X": ["Dual Motor", "Plaid"],
  Cybertruck: ["RWD", "AWD", "Cyberbeast"],
};

/**
 * Bands, not a number. The whitepaper's cost model turns on the distribution
 * of monthly distance (§7.3), and a band is the most an owner can honestly
 * report from memory. Asking for a precise figure would invite a guess and
 * then treat that guess as data.
 */
export const KM_BANDS = [
  { id: "under_500", ko: "월 500km 미만", en: "under 500 km/month" },
  { id: "500_1000", ko: "월 500–1,000km", en: "500–1,000 km/month" },
  { id: "1000_2000", ko: "월 1,000–2,000km", en: "1,000–2,000 km/month" },
  { id: "over_2000", ko: "월 2,000km 이상", en: "over 2,000 km/month" },
] as const;

export type KmBandId = (typeof KM_BANDS)[number]["id"];

export const REGION_IDS = REGIONS.map((r) => r.id) as readonly RegionId[];
export const KM_BAND_IDS = KM_BANDS.map((b) => b.id) as readonly KmBandId[];

export const isRegion = (v: unknown): v is RegionId =>
  typeof v === "string" && (REGION_IDS as readonly string[]).includes(v);

export const isModel = (v: unknown): v is Model =>
  typeof v === "string" && (MODELS as readonly string[]).includes(v);

export const isKmBand = (v: unknown): v is KmBandId =>
  typeof v === "string" && (KM_BAND_IDS as readonly string[]).includes(v);

export const isTrim = (model: Model, v: unknown): boolean =>
  typeof v === "string" && TRIMS[model].includes(v);

/**
 * Deliberately permissive.
 *
 * The confirmation email is what actually proves an address, so a strict
 * pattern here buys nothing and costs real registrations — every year someone
 * loses a valid address to a regex that had never heard of their domain. This
 * rejects what cannot possibly be an address and lets the mail decide the rest.
 */
export const isEmail = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length >= 6 &&
  v.length <= 254 &&
  /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);

/** Addresses are compared and stored in one canonical form, so `A@b.com` and
 *  `a@B.com` cannot each take a seat. */
export const normaliseEmail = (v: string): string => v.trim().toLowerCase();
