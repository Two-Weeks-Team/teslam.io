import { SEATS } from "@/lib/genesis";
import { API_ORIGIN } from "@/lib/site";

/**
 * The public Genesis figures, fetched on the server.
 *
 * Server-side and not in the browser, so the counter is in the HTML. A number
 * that only appears after JavaScript runs is a number a crawler never sees, a
 * reader on a slow connection sees late, and a screenshot may miss entirely —
 * and this is the one figure on the site that is real.
 *
 * A short revalidate rather than a long one: the front page is meant to feel
 * like something filling up, and a seat taken should not take an hour to show.
 * The WebSocket carries it instantly for anyone watching; this is what everyone
 * else gets.
 */

export type GenesisStats = {
  seats: number;
  taken: number;
  waitlist: number;
  byRegion: Array<{ region: string; count: number }>;
  recent: Array<{ seatNo: number; region: string; model: string; at: number }>;
  /** False when the API could not be reached — the page says so rather than
   *  presenting a fallback as a measurement. */
  live: boolean;
};

const EMPTY: GenesisStats = {
  seats: SEATS,
  taken: 0,
  waitlist: 0,
  byRegion: [],
  recent: [],
  live: false,
};

export async function getGenesisStats(): Promise<GenesisStats> {
  try {
    const res = await fetch(`${API_ORIGIN}/v1/genesis/stats`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return EMPTY;

    const body = (await res.json()) as Partial<GenesisStats>;
    if (typeof body.taken !== "number") return EMPTY;

    return {
      seats: body.seats ?? SEATS,
      taken: body.taken,
      waitlist: body.waitlist ?? 0,
      byRegion: body.byRegion ?? [],
      recent: body.recent ?? [],
      live: true,
    };
  } catch {
    // Before the Worker exists, and any time it is unreachable, the page shows
    // zero and says the count is not live. Zero is the truth on day one.
    return EMPTY;
  }
}
