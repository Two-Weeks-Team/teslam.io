"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_ORIGIN } from "@/lib/site";
import type { GenesisStats } from "@/lib/stats";
import { PHASES, demoTimeline, type DemoFrame } from "@/lib/demo";

/**
 * Live figures for the board.
 *
 * The initial values arrive as props from the server, already in the HTML, so
 * the page is correct before any script runs and stays correct if none ever
 * does. This only layers change on top: a seat taken lights up without a
 * reload, and the watcher count is the number of people actually in the room.
 *
 * `watching` is null until a socket is open. That distinction matters — zero
 * watchers and an unknown number of watchers are different facts, and the ticker
 * shows nothing rather than "0" while it does not know.
 */

export type LiveState = {
  taken: number;
  seats: number;
  byRegion: Record<string, number>;
  watching: number | null;
  /** False when the server could not reach the API. The board must not present
   *  a fallback as a measurement. */
  live: boolean;
  /** Whether the API is taking registrations. Decides what the calls to action
   *  are allowed to promise. */
  open: boolean;
  /** The most recent seat, for the flash on the grid and the ripple on the map. */
  justTook: { seatNo: number; region: string } | null;
  /**
   * Rehearsed playback.
   *
   * When `playing`, every figure above comes from the script rather than from
   * the API, and the whole board is showing invented numbers on purpose. It is
   * exposed here, on the same object as the real state, so that no component
   * can read a count without the flag that says what the count is — a consumer
   * that wants one gets both or neither.
   */
  demo: {
    playing: boolean;
    /** 0–1 across the whole script. */
    progress: number;
    /** Index into the phase segments. */
    phase: number;
    phases: number;
    start: () => void;
    stop: () => void;
  };
};

const Ctx = createContext<LiveState | null>(null);

export function useLive(): LiveState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLive outside LiveProvider");
  return v;
}

export function LiveProvider({
  initial,
  children,
}: {
  initial: GenesisStats;
  children: React.ReactNode;
}) {
  const seed = useMemo(
    () => Object.fromEntries(initial.byRegion.map((r) => [r.region, r.count])),
    [initial.byRegion],
  );

  const [taken, setTaken] = useState(initial.taken);
  const [byRegion, setByRegion] = useState<Record<string, number>>(seed);
  const [watching, setWatching] = useState<number | null>(null);
  const [justTook, setJustTook] = useState<LiveState["justTook"]>(null);
  const [live, setLive] = useState(initial.live);
  const [open, setOpen] = useState(initial.open);
  const [frame, setFrame] = useState<DemoFrame | null>(null);
  const timeline = useMemo(() => demoTimeline(), []);
  const runRef = useRef<{ raf: number; startedAt: number } | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // A closed socket must not become a reconnect storm against our own API,
    // so this connects once. A reader who leaves the tab open for a day and
    // misses an event gets the truth on their next navigation.
    const url = `${API_ORIGIN.replace(/^http/, "ws")}/v1/live`;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(url);
    } catch {
      return;
    }

    // A seat confirmed between the server render and this socket opening sends
    // its delta to a subscriber that does not exist yet, and `hello` carries
    // only the watcher count — so without this the page would show a stale
    // total until the reader navigated. Re-reading the aggregate on open costs
    // one request and closes the window.
    socket.addEventListener("open", () => {
      fetch(`${API_ORIGIN}/v1/genesis/stats`)
        .then((r) => (r.ok ? r.json() : null))
        .then((fresh: { taken?: number; open?: boolean; byRegion?: Array<{ region: string; count: number }> } | null) => {
          if (!fresh || typeof fresh.taken !== "number") return;
          setTaken(fresh.taken);
          setByRegion(
            Object.fromEntries((fresh.byRegion ?? []).map((r) => [r.region, r.count])),
          );
          // Registration can be opened without redeploying the site, so a tab
          // left sitting on a cached page picks it up here rather than
          // continuing to offer a button for something that is now possible.
          setOpen(fresh.open === true);
          // The socket reached the API, so the figures are live again even if
          // the server render could not fetch them.
          setLive(true);
        })
        .catch(() => {
          // The server-rendered figures stand. They are only ever stale, never wrong.
        });
    });

    socket.addEventListener("message", (e) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }

      if (msg.type === "hello" || msg.type === "watching") {
        if (typeof msg.watching === "number") setWatching(msg.watching);
        return;
      }

      if (msg.type === "seat.taken" && typeof msg.seatNo === "number") {
        const region = String(msg.region);
        if (typeof msg.taken === "number") setTaken(msg.taken);
        setByRegion((prev) => ({ ...prev, [region]: (prev[region] ?? 0) + 1 }));
        setJustTook({ seatNo: msg.seatNo, region });

        if (clearRef.current) clearTimeout(clearRef.current);
        clearRef.current = setTimeout(() => setJustTook(null), 2600);
      }
    });

    socket.addEventListener("close", () => setWatching(null));
    socket.addEventListener("error", () => setWatching(null));

    return () => {
      if (clearRef.current) clearTimeout(clearRef.current);
      socket?.close();
    };
  }, []);

  /*
   * Playback.
   *
   * The clock is read from `performance.now()` on every frame rather than
   * accumulated, so a dropped frame or a backgrounded tab resumes at the right
   * point instead of quietly falling behind the script and never catching up.
   */
  const stop = useCallback(() => {
    if (runRef.current) cancelAnimationFrame(runRef.current.raf);
    runRef.current = null;
    // A clean cut back to the real figures. Reversing the fill would be a
    // second animation of invented data, and would read as the board losing
    // registrations.
    setFrame(null);
  }, []);

  const start = useCallback(() => {
    if (runRef.current) return;
    const startedAt = performance.now();

    const step = (now: number) => {
      const next = timeline.at(now - startedAt);
      setFrame(next);
      if (next.done) {
        // Hold on the finished board, then hand the page back. The script ends
        // rather than looping: five hundred of five hundred is a conclusion,
        // and looping past it throws the moment away.
        runRef.current = null;
        return;
      }
      runRef.current = { raf: requestAnimationFrame(step), startedAt };
    };

    runRef.current = { raf: requestAnimationFrame(step), startedAt };
  }, [timeline]);

  useEffect(() => stop, [stop]);

  const value = useMemo<LiveState>(() => {
    const playing = frame !== null;

    return {
      // While the script runs it owns every figure on the board. Mixing a real
      // count with rehearsed ones would produce a number that is neither.
      taken: playing ? frame.taken : taken,
      seats: initial.seats,
      byRegion: playing ? frame.byRegion : byRegion,
      justTook: playing ? frame.justTook : justTook,
      // The watcher count stays real throughout: it is measured from open
      // sockets and the script has no business inventing people in the room.
      watching,
      live,
      open,
      demo: {
        playing,
        progress: frame?.progress ?? 0,
        phase: frame?.phase ?? 0,
        phases: PHASES.length,
        start,
        stop,
      },
    };
  }, [frame, taken, initial.seats, byRegion, justTook, watching, live, open, start, stop]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
