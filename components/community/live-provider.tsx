"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_ORIGIN } from "@/lib/site";
import type { GenesisStats } from "@/lib/stats";

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
  /** The most recent seat, for the flash on the grid and the ripple on the map. */
  justTook: { seatNo: number; region: string } | null;
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

  const value = useMemo<LiveState>(
    () => ({ taken, seats: initial.seats, byRegion, watching, justTook }),
    [taken, initial.seats, byRegion, watching, justTook],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
