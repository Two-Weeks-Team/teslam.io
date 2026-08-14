/**
 * What the board is made of.
 *
 * Shared between the site and the Worker, which is why the labels are here and
 * not in the database: `data/community.json` used to carry board names as
 * Korean strings, and both locales read that file, so /en rendered 소프트웨어
 * verbatim. An identifier crosses the wire; a name is chosen at render time.
 *
 * The limits are here for the same reason a validator belongs next to the
 * thing it validates — the form and the endpoint must agree about what is too
 * long, and two copies of a number eventually disagree.
 */

export const BOARDS = [
  { id: "free", ko: "자유", en: "General" },
  { id: "software", ko: "소프트웨어", en: "Software" },
  { id: "shots", ko: "인증샷", en: "Shots" },
  { id: "fsd", ko: "FSD 후기", en: "FSD" },
  { id: "charge", ko: "충전·전기", en: "Charging" },
  { id: "tire", ko: "타이어·휠", en: "Tyres & wheels" },
  { id: "insurance", ko: "보험·사고", en: "Insurance" },
  { id: "used", ko: "중고·시세", en: "Used & resale" },
] as const;

export type BoardId = (typeof BOARDS)[number]["id"];

export const BOARD_IDS = BOARDS.map((b) => b.id) as readonly BoardId[];

export const isBoard = (v: unknown): v is BoardId =>
  typeof v === "string" && (BOARD_IDS as readonly string[]).includes(v);

export const SORTS = ["hot", "new"] as const;
export type Sort = (typeof SORTS)[number];
export const isSort = (v: unknown): v is Sort =>
  typeof v === "string" && (SORTS as readonly string[]).includes(v);

/**
 * Length limits, in Unicode code points rather than UTF-16 units.
 *
 * `"가".length` and `"a".length` are both 1, but an emoji is 2 — so a byte or
 * unit count silently gives a Korean writer a shorter post than an English one
 * and cuts a surrogate pair in half at the boundary. Counting code points is
 * the version a person would recognise as "characters".
 */
export const LIMITS = {
  title: { min: 2, max: 120 },
  body: { min: 1, max: 8000 },
  comment: { min: 1, max: 2000 },
  handle: { min: 2, max: 20 },
} as const;

export const countChars = (s: string): number => [...s].length;

/**
 * Handles are checked, not sanitised.
 *
 * Silently stripping characters hands somebody a name they did not choose, and
 * two different inputs can be stripped to the same string — which is a
 * collision on a column the board treats as an identity.
 */
const HANDLE_OK = /^[\p{L}\p{N}_.-]+$/u;

export function handleProblem(v: unknown): "type" | "length" | "charset" | null {
  if (typeof v !== "string") return "type";
  const trimmed = v.trim();
  const len = countChars(trimmed);
  if (len < LIMITS.handle.min || len > LIMITS.handle.max) return "length";
  if (!HANDLE_OK.test(trimmed)) return "charset";
  return null;
}

/** The shape the API returns for one row in a list. */
export type PostSummary = {
  id: string;
  board: BoardId;
  title: string;
  handle: string;
  createdAt: number;
  votes: number;
  comments: number;
  /** Whether the caller has voted. Null when the caller is not signed in. */
  voted: boolean | null;
};

export type Comment = {
  id: string;
  handle: string;
  body: string;
  createdAt: number;
};

export type PostDetail = PostSummary & { body: string; thread: Comment[] };
