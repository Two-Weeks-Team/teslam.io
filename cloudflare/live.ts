import { DurableObject } from "cloudflare:workers";

/**
 * The live board.
 *
 * One instance holds every open connection, so a seat taken in Busan lights up
 * on a screen in Seoul without either page asking. That immediacy is the point:
 * a cohort of 500 filling up is only tense if you can watch it happen.
 *
 * Two design choices worth stating.
 *
 * It carries deltas, not state. The initial figures already arrive with the
 * page from `/v1/genesis/stats`, server-rendered, so a reader with JavaScript
 * disabled still sees real numbers. The socket only reports what changed since,
 * which means this object never needs a database binding and can never disagree
 * with one.
 *
 * It uses the hibernation API. `ctx.acceptWebSocket` lets the runtime evict the
 * object from memory while sockets stay open, so a hundred people watching an
 * empty board overnight cost nothing. A conventional `addEventListener` socket
 * would hold the object resident for as long as anyone kept a tab open.
 */

type Hello = { type: "hello"; watching: number };
type Watching = { type: "watching"; watching: number };
type SeatTaken = {
  type: "seat.taken";
  seatNo: number;
  region: string;
  model: string;
  taken: number;
};

export type LiveEvent = Hello | Watching | SeatTaken;

export class LiveBoard extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal: the worker reports a confirmed seat. Not routed publicly —
    // reaching this object at all requires the worker's binding.
    if (url.pathname === "/notify") {
      const event = (await request.json()) as SeatTaken;
      this.broadcast(event);
      return new Response(null, { status: 204 });
    }

    if (request.headers.get("upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    // The count includes this socket — `acceptWebSocket` has already registered
    // it — so the new arrival and everyone else are told the same number.
    const watching = this.ctx.getWebSockets().length;
    server.send(JSON.stringify({ type: "hello", watching } satisfies Hello));
    this.broadcast({ type: "watching", watching }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Clients send nothing. Anything arriving is either a probe or a bug, and
   * echoing it would turn this into an open relay between strangers' browsers.
   */
  webSocketMessage(): void {}

  webSocketClose(ws: WebSocket): void {
    // The runtime removes the socket from the list *before* calling this, so
    // the length is already the count of who remains. Subtracting one here —
    // as an earlier version did, assuming the opposite — reported zero watchers
    // whenever one of two people left.
    const watching = this.ctx.getWebSockets().length;
    this.broadcast({ type: "watching", watching }, ws);
  }

  webSocketError(ws: WebSocket): void {
    this.webSocketClose(ws);
  }

  private broadcast(event: LiveEvent, except?: WebSocket): void {
    const payload = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(payload);
      } catch {
        // A socket that died between the listing and the send is not an error
        // worth failing a registration over.
      }
    }
  }
}
