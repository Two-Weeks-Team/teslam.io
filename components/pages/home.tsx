import { Bar } from "@/components/community/bar";
import { CHero } from "@/components/community/hero";
import { League } from "@/components/community/league";
import { Feed } from "@/components/community/feed";
import { LeftRail, RightRail } from "@/components/community/rails";
import { CFooter } from "@/components/community/footer";
import { JsonLd } from "@/components/jsonld";
import { getContent, type Locale } from "@/lib/i18n";
import cm from "@/data/community.json";

/**
 * The community front page.
 *
 * Order is the argument: identity and the seat you could take, then the
 * competition that brings you back, then the board that is the actual product,
 * with the wallet parked beside it. The cost model that used to be here now
 * lives at `/model` — it is a document for a partner, not a reason for an
 * owner to visit.
 */
export function HomePage({ locale }: { locale: Locale }) {
  const t = getContent(locale);

  return (
    <div className="cm">
      <JsonLd locale={locale} />
      <Bar locale={locale} />

      <div className="cm__wrap">
        {cm.isPreview ? (
          <p className="pv">
            <span className="pv__tag">{t.preview.tag}</span>
            <span className="pv__b">{t.preview.body}</span>
          </p>
        ) : null}

        <CHero locale={locale} />
        <League locale={locale} />

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
