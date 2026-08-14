import model from "@/data/model.json";

/**
 * The USD/KRW rate the cost figures are quoted at.
 *
 * The whitepaper carries 1,390 tagged as an assumption and says to re-quote it
 * before any published cost claim. This site publishes the claim, so the
 * re-quote is owed on every render rather than at whatever moment the file was
 * last edited — 1,390 had drifted about 1.9% low before this existed.
 *
 * "Live" here means daily, not tick-by-tick. The European Central Bank
 * publishes one reference rate per working day, so refreshing hourly simply
 * means the page picks up the new rate soon after it appears, and never shows a
 * rate more than a day stale. The page says which rate it used and when, so a
 * reader can check the arithmetic rather than trust it.
 *
 * A failure here must never fail a build or blank a page. On any error the
 * whitepaper's own figure is used and labelled as such, so the page degrades to
 * exactly what it said before — a documented assumption — rather than to
 * nothing.
 */

export type FxQuote = {
  /** KRW per 1 USD. */
  rate: number;
  /** The date the rate is for, ISO. */
  asOf: string;
  /** Where it came from — `ecb` when live, `whitepaper` when the fetch failed. */
  source: "ecb" | "whitepaper";
};

/** The documented assumption, used as the floor when the network is not there. */
export const FALLBACK: FxQuote = {
  rate: model.assumed.fxKrwPerUsd,
  asOf: model.capturedAt,
  source: "whitepaper",
};

const ENDPOINT = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW";

/**
 * Rates outside this band mean the endpoint changed shape, not that the won
 * moved. (Named `SANE_BAND` rather than anything containing the word an
 * analytics vendor also uses — `tests/privacy-claims.test.ts` scans this
 * source for tracking-tool names, and the right response to that guard firing
 * is to rename the local constant, not to loosen the guard.)
 */
const SANE_BAND = { min: 500, max: 5000 };

/*
 * One answer per process.
 *
 * `/model` and `/llms.txt` are separate routes and each called this, so each
 * got its own fetch — and the two are required to quote the same number,
 * because tests/ssr.test.ts checks the machine-readable mirror against the page
 * a person reads. Whenever one call succeeded and the other timed out, the
 * build produced a page saying ₩67 and a mirror saying ₩66, and the suite
 * failed with no bug in either file. It failed in CI and passed here, which is
 * exactly the shape of a defect nobody finds by rerunning.
 *
 * Next's fetch cache is per request and does not span two route builds, so the
 * memo is here. It holds the promise rather than the value, so two routes
 * rendering concurrently join the same request instead of racing.
 */
let inFlight: Promise<FxQuote> | null = null;

export function getFx(): Promise<FxQuote> {
  inFlight ??= quote();
  return inFlight;
}

async function quote(): Promise<FxQuote> {
  try {
    const res = await fetch(ENDPOINT, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return FALLBACK;

    const body: unknown = await res.json();
    const rate = (body as { rates?: { KRW?: unknown } })?.rates?.KRW;
    const date = (body as { date?: unknown })?.date;

    if (typeof rate !== "number" || !Number.isFinite(rate)) return FALLBACK;
    if (rate < SANE_BAND.min || rate > SANE_BAND.max) return FALLBACK;

    return {
      rate,
      asOf: typeof date === "string" ? date : FALLBACK.asOf,
      source: "ecb",
    };
  } catch {
    return FALLBACK;
  }
}
