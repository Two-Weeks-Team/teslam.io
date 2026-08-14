import { Bar } from "@/components/community/bar";
import { MapHero } from "@/components/community/map-hero";
import { Cohort } from "@/components/community/cohort";
import { RouteMap } from "@/components/community/route-map";
import { Badges, Quests, Shop } from "@/components/community/perks";
import { League } from "@/components/community/league";
import { Feed } from "@/components/community/feed";
import { LeftRail, RightRail } from "@/components/community/rails";
import { CFooter } from "@/components/community/footer";
import { JsonLd } from "@/components/jsonld";
import { type Locale } from "@/lib/i18n";
import { getGenesisStats } from "@/lib/stats";
import { LiveProvider } from "@/components/community/live-provider";
import { PreviewBanner } from "@/components/community/preview-banner";
import cm from "@/data/community.json";

/**
 * The community front page.
 *
 * Order is the argument, and the argument changed: the country comes first,
 * then the cohort as the object it is a cohort of, then the competition that
 * brings people back, then the board that is the actual product. What used to
 * lead — a headline beside a panel of five hundred grey squares — said less in
 * more space than the map does in a glance.
 *
 * Everything above the league is a live figure or a drawing of one. Everything
 * below it is still sample content, and still labelled as such.
 */
export async function HomePage({ locale }: { locale: Locale }) {
  const stats = await getGenesisStats();

  return (
    <LiveProvider initial={stats}>
      <HomeBoard locale={locale} />
    </LiveProvider>
  );
}

function HomeBoard({ locale }: { locale: Locale }) {
  return (
    <div className="cm">
      <JsonLd locale={locale} />
      <Bar locale={locale} />

      <div className="cm__wrap">
        {cm.isPreview ? <PreviewBanner locale={locale} /> : null}

        <MapHero locale={locale} />
        <Cohort locale={locale} />
        <RouteMap locale={locale} />
        <Quests locale={locale} />
        <League locale={locale} />
        <Badges locale={locale} />
        <Shop locale={locale} />

        <div className="cols">
          <LeftRail locale={locale} />
          <main>
            <Feed locale={locale} />
          </main>
          <RightRail locale={locale} />
        </div>

        <CFooter locale={locale} />
      </div>
    </div>
  );
}
