"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_ORIGIN } from "@/lib/site";

/**
 * Who is reading, as far as the board is concerned.
 *
 * There is no login form anywhere on this site. Confirming the registration
 * mail is what creates the account and issues the session, so this only ever
 * discovers a session that already exists — it cannot create one, and there is
 * nothing here for a stranger to attack.
 *
 * The token itself is never visible to this code. It is an HttpOnly cookie the
 * Worker set, which is why nothing in `app/`, `components/` or `lib/` touches a
 * storage API and the privacy policy's claim about browsing still holds.
 *
 * `handle` is undefined until the first answer arrives, and null once we know
 * nobody is signed in. The button that writes a post must not flash "sign in"
 * at a member who is, so the difference is kept.
 */

type SessionState = {
  handle: string | null | undefined;
  signedIn: boolean;
  signOut: () => Promise<void>;
  /** Re-read after something that could have changed it — setting a handle,
   *  or landing back from a confirmation. */
  refresh: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

/** Every board request carries the cookie, and none of them may be cached. */
export const board = (path: string, init: RequestInit = {}) =>
  fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [handle, setHandle] = useState<string | null | undefined>(undefined);
  /** Bumped to ask again. The effect owns the request; `refresh` only says
   *  when, which keeps the state update inside a promise callback rather than
   *  in the effect body where it would cascade. */
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    let cancelled = false;

    board("/v1/board/me")
      .then((res) => (res.ok ? res.json() : { handle: null }))
      .then((body: { handle: string | null }) => {
        if (!cancelled) setHandle(body.handle ?? null);
      })
      .catch(() => {
        // An unreachable API is indistinguishable from being signed out, and
        // the page behaves the same way in both: it offers to read, not write.
        if (!cancelled) setHandle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [asked]);

  const refresh = useCallback(async () => {
    setAsked((n) => n + 1);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await board("/v1/board/signout", { method: "POST" });
    } finally {
      // Set regardless. If the request failed, the cookie may still be live,
      // but continuing to show a signed-in state after somebody pressed sign
      // out is the worse of the two wrong answers.
      setHandle(null);
    }
  }, []);

  return (
    <Ctx.Provider value={{ handle, signedIn: typeof handle === "string", signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
