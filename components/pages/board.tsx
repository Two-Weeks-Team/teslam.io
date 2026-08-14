import { Bar } from "@/components/community/bar";
import { CFooter } from "@/components/community/footer";
import { Feed } from "@/components/community/feed";
import { LeftRail } from "@/components/community/rails";
import { SessionProvider } from "@/components/community/session";
import { getBoardCounts, getPosts } from "@/lib/posts";
import { getCapabilities, modeFor, showExample } from "@/lib/showcase";
import { isBoard, isSort, type BoardId, type Sort } from "@/lib/board";
import { getContent, type Locale } from "@/lib/i18n";
import { getGenesisStats } from "@/lib/stats";
import { LiveProvider } from "@/components/community/live-provider";

/**
 * The board on its own page.
 *
 * The front page carries a slice of it between the map and the footer, which
 * is right for a landing page and wrong for reading. This is the address a
 * member sends somebody, the one the rail filters into, and the one a thread's
 * breadcrumb comes back to.
 *
 * The filter arrives in the query string rather than in component state so that
 * a filtered board is a link. State would make it a place you can only reach by
 * clicking.
 */
export async function BoardPage({
  locale,
  search,
}: {
  locale: Locale;
  search: { board?: string; sort?: string };
}) {
  const t = getContent(locale).feed;

  const boardId: BoardId | undefined = isBoard(search.board)
    ? search.board
    : undefined;
  const sort: Sort = isSort(search.sort) ? search.sort : "hot";

  // The top bar shows the seat count and the watcher count, so it needs the
  // live context wherever it appears. It is drawn here as well as on the front
  // page, and leaving that provider out is not a missing number — `useLive`
  // throws, and the whole route becomes a runtime error the moment it hydrates.
  const [caps, posts, counts, stats] = await Promise.all([
    getCapabilities(),
    getPosts({ board: boardId, sort }),
    getBoardCounts(),
    getGenesisStats(),
  ]);

  const mode = modeFor("board", caps);

  return (
    <SessionProvider>
      <LiveProvider initial={stats}>
        <div className="cm">
          <Bar locale={locale} />
          <div className="cm__wrap">
            <h1 className="brd__h">{t.pageTitle}</h1>
            <div className="cols cols--board">
              <LeftRail
                locale={locale}
                counts={counts}
                live={caps.live.board}
              />
              <main>
                <Feed
                  locale={locale}
                  mode={mode}
                  initial={posts}
                  now={posts.now}
                  example={showExample(caps, "board")}
                />
              </main>
            </div>
            <CFooter locale={locale} />
          </div>
        </div>
      </LiveProvider>
    </SessionProvider>
  );
}
