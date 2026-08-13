import { REGIONS, SEATS, type RegionId } from "@/lib/genesis";

/**
 * A rehearsed run of the cohort filling up.
 *
 * The board is honest and therefore empty: nobody has registered, so every
 * number on it is zero and the page cannot show what it is for. This script is
 * the answer — a visitor presses play and watches five hundred seats land, then
 * presses stop and gets the real zero back.
 *
 * Three properties matter more than the animation:
 *
 * 1. **It never runs on its own.** No autoplay, ever. WCAG 2.2.2 requires a
 *    stop control for motion that starts by itself, and beyond compliance,
 *    overwriting a real measurement with an invented one without being asked is
 *    the exact thing this site is built not to do.
 * 2. **It is deterministic.** Same script every run, seeded rather than random,
 *    so what the operator rehearses is what a visitor sees and a screenshot can
 *    be reproduced.
 * 3. **The arrivals are lumpy.** Real registration comes in bursts — a share
 *    lands, twenty people arrive, then an hour of nothing. A seat every 76ms
 *    exactly reads as a progress bar with extra steps, which is both less
 *    convincing and less honest about what growth looks like.
 */

export type DemoEvent = {
  /** Milliseconds from the start of playback. */
  at: number;
  /** Seat ordinal, 1-based. */
  seat: number;
  region: RegionId;
};

export type DemoPhase = {
  id: string;
  /** Milliseconds from the start, at which this phase ends. */
  until: number;
};

/**
 * Phases, drawn as segments the way a story bar is.
 *
 * They are not decoration: the pace changes at each boundary, and a viewer who
 * can see the boundaries can tell that the acceleration is deliberate rather
 * than a stutter.
 */
export const PHASES: DemoPhase[] = [
  { id: "first", until: 6_000 },
  { id: "spread", until: 16_000 },
  { id: "rush", until: 28_000 },
  { id: "close", until: 36_000 },
];

/** How long the finished board is held before the script reports itself done. */
export const HOLD_MS = 3_400;

export const DEMO_DURATION = PHASES[PHASES.length - 1].until + HOLD_MS;

/**
 * Where the cohort comes from.
 *
 * Weighted toward the capital because that is where the cars are — a flat
 * distribution across seven regions would light the map evenly and quietly
 * misrepresent the country. The weights are a plausible shape, not a forecast,
 * and nothing downstream treats them as one.
 */
const WEIGHTS: Array<[RegionId, number]> = [
  ["capital", 42],
  ["busan", 15],
  ["chungcheong", 12],
  ["daegu", 11],
  ["jeolla", 10],
  ["gangwon", 6],
  ["jeju", 4],
];

/** Deterministic. A demo that differs run to run cannot be rehearsed. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    // xorshift32 — small, fast, and good enough to place five hundred dots.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

function pickRegion(random: () => number): RegionId {
  const total = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let n = random() * total;
  for (const [id, w] of WEIGHTS) {
    n -= w;
    if (n <= 0) return id;
  }
  return WEIGHTS[0][0];
}

/**
 * The seat arrival times.
 *
 * Paced so the first few land slowly enough to be understood — a viewer has to
 * see one seat arrive and grasp what it means before five hundred of them do —
 * and the last hundred land in a flourish. Between those, arrivals cluster:
 * short bursts separated by gaps.
 */
export function demoScript(): DemoEvent[] {
  const random = seeded(0x7e51a);
  const events: DemoEvent[] = [];

  // Seats per phase, weighted toward the later ones so the pace visibly builds.
  const share = [12, 108, 260, SEATS - 380];
  let phaseStart = 0;

  PHASES.forEach((phase, p) => {
    const span = phase.until - phaseStart;
    const count = share[p];

    // Lay the arrivals down on an eased curve inside the phase, then jitter
    // each one. Evenly spaced arrivals are what makes a simulation look like a
    // loading bar.
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      // Ease-out inside the phase: busy at the start, thinning toward the
      // handover, which is what a burst actually looks like.
      const eased = 1 - (1 - t) * (1 - t);
      const jitter = (random() - 0.5) * (span / count) * 2.2;
      events.push({
        // Clamped into the phase. Unclamped, the jitter on the last arrival
        // could push it past the final boundary — a seat landing after the
        // progress bar had already filled, which reads as the run finishing
        // and then continuing.
        at: Math.min(phase.until, Math.max(0, phaseStart + eased * span + jitter)),
        seat: 0, // assigned below, in time order
        region: pickRegion(random),
      });
    }

    phaseStart = phase.until;
  });

  // Seat numbers follow arrival order, because that is what they mean: seat 1
  // is the first person to confirm, not the first row of the array.
  events.sort((a, b) => a.at - b.at);
  events.forEach((e, i) => {
    e.seat = i + 1;
  });

  return events;
}

export type DemoFrame = {
  taken: number;
  byRegion: Record<string, number>;
  /** The seat that landed most recently, for the flash and the map ripple. */
  justTook: { seatNo: number; region: string } | null;
  /** 0–1 across the whole script, for the progress bar. */
  progress: number;
  phase: number;
  done: boolean;
};

/**
 * Everything needed to answer "what does the board look like at time t".
 *
 * Precomputed once per playback rather than accumulated frame by frame. An
 * accumulator drifts when a frame is dropped or the tab is backgrounded, and
 * the failure it produces — a board that is behind the clock and never catches
 * up — is invisible until someone counts.
 */
export function demoTimeline() {
  const events = demoScript();

  // Cumulative region counts after each event, so any time maps to a state
  // with one lookup instead of a replay.
  const cumulative: Array<Record<string, number>> = [];
  const running: Record<string, number> = Object.fromEntries(
    REGIONS.map((r) => [r.id, 0]),
  );

  for (const event of events) {
    running[event.region] += 1;
    cumulative.push({ ...running });
  }

  const empty: Record<string, number> = Object.fromEntries(
    REGIONS.map((r) => [r.id, 0]),
  );

  function at(elapsed: number): DemoFrame {
    // Last event whose time has passed.
    let lo = 0;
    let hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].at <= elapsed) lo = mid + 1;
      else hi = mid;
    }

    const taken = lo;
    const last = taken > 0 ? events[taken - 1] : null;
    const fresh = last !== null && elapsed - last.at < 2_600;

    return {
      taken,
      byRegion: taken > 0 ? cumulative[taken - 1] : empty,
      justTook: fresh && last ? { seatNo: last.seat, region: last.region } : null,
      progress: Math.min(1, elapsed / DEMO_DURATION),
      phase: PHASES.findIndex((p) => elapsed < p.until) === -1
        ? PHASES.length - 1
        : PHASES.findIndex((p) => elapsed < p.until),
      done: elapsed >= DEMO_DURATION,
    };
  }

  return { events, at };
}
