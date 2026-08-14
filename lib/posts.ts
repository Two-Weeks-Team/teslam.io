import { API_ORIGIN } from "@/lib/site";
import type { BoardId, PostDetail, PostSummary, Sort } from "@/lib/board";

/**
 * The board, fetched on the server.
 *
 * The first page is in the HTML for the same reason the seat counter is: a
 * community site whose posts appear only after JavaScript runs is a blank page
 * to a crawler, a slow page on a bad connection, and an empty screenshot. The
 * client takes over for voting, paging and writing — the things that need a
 * reader who is present.
 *
 * These requests are anonymous by construction. Cookies are not forwarded from
 * the incoming request, so what the server renders is what a signed-out visitor
 * would see, which is exactly what a shared cache is allowed to hold. Vote
 * state arrives on the client, where it belongs to one reader.
 */

/**
 * `now` rides along with the data.
 *
 * Relative times ("3분 전") need a reference point, and reading the clock inside
 * a component is both impure and a hydration hazard — the server would compute
 * one answer and the client another, and the post most likely to differ is the
 * newest one, which is the one people look at. Stamping it here, in the
 * function that already had to be async, gives both renders the same number.
 */
export type Page = { posts: PostSummary[]; more: boolean; now: number };

const stamp = () => Math.floor(Date.now() / 1000);

const empty = (): Page => ({ posts: [], more: false, now: stamp() });

export async function getPosts(opts: {
  board?: BoardId;
  sort?: Sort;
  page?: number;
} = {}): Promise<Page> {
  const params = new URLSearchParams({
    sort: opts.sort ?? "hot",
    page: String(opts.page ?? 0),
  });
  if (opts.board) params.set("board", opts.board);

  try {
    const res = await fetch(`${API_ORIGIN}/v1/board/posts?${params}`, {
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return empty();

    const body = (await res.json()) as Partial<Page>;
    return Array.isArray(body.posts)
      ? { posts: body.posts, more: body.more === true, now: stamp() }
      : empty();
  } catch {
    // An unreachable board is an empty board as far as this render is
    // concerned. The page says which it is; this function does not guess.
    return empty();
  }
}

export async function getPost(
  id: string,
): Promise<{ post: PostDetail; now: number } | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/v1/board/posts/${encodeURIComponent(id)}`, {
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PostDetail;
    return typeof body?.id === "string" ? { post: body, now: stamp() } : null;
  } catch {
    return null;
  }
}

export async function getBoardCounts(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${API_ORIGIN}/v1/board/counts`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { counts?: Record<string, number> };
    return body.counts ?? {};
  } catch {
    return {};
  }
}
