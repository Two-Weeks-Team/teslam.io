import { API_ORIGIN } from "@/lib/site";

/**
 * Whether the site is allowed to draw things it made up.
 *
 * One switch, `NEXT_PUBLIC_SHOWCASE`. Off means no invented post, rank, badge
 * or balance appears anywhere, and the rehearsed Genesis playback is gone with
 * them — they are the same claim about the page and belong behind the same
 * word.
 *
 * What the switch deliberately does NOT decide is which sections are real. If
 * it did, shipping a leaderboard backend would mean editing a constant in this
 * repository and redeploying the site, and the two would drift: the API would
 * be serving rankings while the page still called them sample content, or
 * worse, the other way round. Instead the API publishes what it can actually
 * answer, and this file turns that into a rendering decision.
 *
 * Default on. A missing environment variable in a preview build should show the
 * site as designed rather than silently stripping half of it.
 */
export const SHOWCASE = process.env.NEXT_PUBLIC_SHOWCASE !== "off";

/**
 * A data source the API either has or does not have.
 *
 * `seats` and `board` read their own tables. Everything else is computed from
 * odometer readings, and no vehicle is linked to an account yet — which is why
 * they are listed here at all rather than assumed.
 */
export type Capability =
  | "seats"
  | "board"
  | "league"
  | "quests"
  | "badges"
  | "wallet"
  | "garage"
  | "shop";

export type Capabilities = {
  live: Record<Capability, boolean>;
  counts: { posts: number };
  /** False when the API could not be reached. Distinct from "everything is
   *  off": one is a fact about the service, the other about the network. */
  reached: boolean;
};

/**
 * What a section should draw.
 *
 * `real`   — the API has this; render measurements.
 * `sample` — it does not, but invented content is permitted and will be marked.
 * `hidden` — it does not, and invented content is forbidden. Draw nothing.
 */
export type Mode = "real" | "sample" | "hidden";

export function modeFor(cap: Capability, caps: Capabilities): Mode {
  if (caps.live[cap]) return "real";
  return SHOWCASE ? "sample" : "hidden";
}

/**
 * Whether a section that is real may *also* show what it looks like populated.
 *
 * The first version of this scheme had a hole in it, and the hole opened the
 * moment the board went live: a real source with nothing in it rendered as
 * "real", which is truthful and reads as a dead room. A visitor who arrives at
 * an empty board learns nothing about what they are being invited to join, and
 * the honest empty state is doing them no favours.
 *
 * So the rule is that a section should be full wherever it can be and emptiable
 * everywhere. `real` decides whether the numbers are measurements; this decides
 * whether an example sits beside them. The example is always labelled and
 * always behind the same switch, so one setting still strips the whole site
 * back to what it can prove.
 */
export function showExample(caps: Capabilities, cap: Capability): boolean {
  if (!SHOWCASE) return false;
  // Not live means the section is already drawing sample content; a second
  // example under it would be the same thing twice.
  return caps.live[cap];
}

/**
 * Nothing is live until the API says so.
 *
 * Defaulting to true anywhere here would mean an unreachable API renders as a
 * page full of empty "real" sections, which reads as a dead service rather
 * than an unreachable one.
 */
const NONE: Capabilities = {
  live: {
    seats: false,
    board: false,
    league: false,
    quests: false,
    badges: false,
    wallet: false,
    garage: false,
    shop: false,
  },
  counts: { posts: 0 },
  reached: false,
};

const CAPABILITY_KEYS = Object.keys(NONE.live) as Capability[];

export async function getCapabilities(): Promise<Capabilities> {
  try {
    const res = await fetch(`${API_ORIGIN}/v1/capabilities`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return NONE;

    const body = (await res.json()) as Record<string, unknown> & {
      counts?: { posts?: number };
    };

    // Read key by key rather than spreading the response. A future field on
    // the API must not become a capability this build has never heard of, and
    // a missing one must read as "not live" rather than as `undefined`.
    const live = Object.fromEntries(
      CAPABILITY_KEYS.map((k) => [k, body[k] === true]),
    ) as Record<Capability, boolean>;

    return {
      live,
      counts: { posts: Number(body.counts?.posts ?? 0) || 0 },
      reached: true,
    };
  } catch {
    return NONE;
  }
}
