import { Bar } from "@/components/community/bar";
import { MapHero } from "@/components/community/map-hero";
import { Cohort } from "@/components/community/cohort";
import { RouteMap } from "@/components/community/route-map";
import { Badges, Quests, Shop } from "@/components/community/perks";
import { Onboard, Proof } from "@/components/community/proof";
import { Signals } from "@/components/community/signals";
import { Ladder, Nameplate, Stake, Streak } from "@/components/community/identity";
import { League } from "@/components/community/league";
import { Feed } from "@/components/community/feed";
import { LeftRail, RightRail } from "@/components/community/rails";
import { CFooter } from "@/components/community/footer";
import { JsonLd } from "@/components/jsonld";
import { type Locale } from "@/lib/i18n";
import { getGenesisStats } from "@/lib/stats";
import { getBoardCounts, getPosts, type Page } from "@/lib/posts";
import { getCapabilities, modeFor, showExample, SHOWCASE, type Capabilities } from "@/lib/showcase";
import { LiveProvider } from "@/components/community/live-provider";
import { SessionProvider } from "@/components/community/session";
import { PreviewBanner } from "@/components/community/preview-banner";

/**
 * The community front page.
 *
 * Order is the argument: the country first, then the cohort it is a cohort of,
 * then the competition that brings people back, then the board that is the
 * actual product.
 *
 * What each section draws is not decided here. `/v1/capabilities` says which
 * data sources the API actually has, and `modeFor` turns that into one of three
 * answers per section — real, sample, or nothing at all. The consequence worth
 * stating plainly: shipping a backend is what promotes a section from sample to
 * real. No constant in this file has to be remembered and edited afterwards,
 * and no section can go on calling itself sample content once it stops being
 * any such thing.
 */
export async function HomePage({ locale }: { locale: Locale }) {
  // One round trip each, in parallel. The board fetch is wasted when the board
  // is not live, which is one request against a page that would otherwise wait
  // for capabilities before it could even start asking.
  const [stats, caps, posts, boardCounts] = await Promise.all([
    getGenesisStats(),
    getCapabilities(),
    getPosts({ sort: "hot" }),
    getBoardCounts(),
  ]);

  return (
    <SessionProvider>
      <LiveProvider initial={stats}>
        <HomeBoard locale={locale} caps={caps} posts={posts} boardCounts={boardCounts} />
      </LiveProvider>
    </SessionProvider>
  );
}

function HomeBoard({
  locale,
  caps,
  posts,
  boardCounts,
}: {
  locale: Locale;
  caps: Capabilities;
  posts: Page;
  boardCounts: Record<string, number>;
}) {
  const mode = (cap: Parameters<typeof modeFor>[0]) => modeFor(cap, caps);

  const league = mode("league");
  const quests = mode("quests");
  const badges = mode("badges");
  const garage = mode("garage");
  const wallet = mode("wallet");
  const shop = mode("shop");

  return (
    <div className="cm">
      <JsonLd locale={locale} />
      <Bar locale={locale} />

      <div className="cm__wrap">
        {/* The banner explains what is invented. With the switch off nothing
            is, so the sentence would be describing an absence. */}
        {SHOWCASE ? <PreviewBanner locale={locale} /> : null}

        {/*
          * The order is the argument, and it changed.
          *
          * It used to open on "this is where the owners are", which is what the
          * site called itself rather than anything a visitor could check, and
          * then went straight to a map. Now it opens on the one claim that is
          * checkable — the numbers here were made by a car — and spends the
          * next three sections earning it: what actually travels, why a GPS
          * score could be walked and this one cannot, and how to start.
          *
          * Only then the country, the game, the standings, and last the board,
          * which is the thing a member comes back for rather than the thing
          * that convinces them to arrive.
          */}
        <MapHero locale={locale} />
        <Signals locale={locale} />
        <Proof locale={locale} />
        <Onboard locale={locale} />

        <RouteMap locale={locale} />

        {quests === "hidden" ? null : <Quests locale={locale} />}
        {league === "hidden" ? null : <League locale={locale} />}
        {garage === "hidden" ? null : <Streak locale={locale} />}
        {badges === "hidden" ? null : <Badges locale={locale} />}
        {garage === "hidden" ? null : <Ladder locale={locale} />}
        {garage === "hidden" ? null : <Nameplate locale={locale} />}
        {shop === "hidden" ? null : <Shop locale={locale} />}
        {wallet === "hidden" ? null : <Stake locale={locale} />}

        <Cohort locale={locale} />

        <div className="cols">
          <LeftRail locale={locale} counts={boardCounts} live={caps.live.board} />
          <main>
            <Feed
              locale={locale}
              mode={mode("board")}
              initial={posts}
              now={posts.now}
              example={showExample(caps, "board")}
            />
          </main>
          <RightRail locale={locale} caps={caps} />
        </div>

        <CFooter locale={locale} />
      </div>
    </div>
  );
}
