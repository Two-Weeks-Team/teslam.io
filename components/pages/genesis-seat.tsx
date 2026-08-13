import { notFound } from "next/navigation";
import { SeatCluster } from "@/components/genesis/seat-cluster";
import { CFooter } from "@/components/community/footer";
import { SEATS } from "@/lib/genesis";
import { genesisPathFor, getGenesis, pathFor, type Locale } from "@/lib/i18n";

/**
 * A shareable seat.
 *
 * This route exists because the confirmation screen offers to copy a link to
 * it — an offer that, until this file, led to a 404. A share button that hands
 * someone a broken URL is worse than no share button.
 *
 * It renders from the number in the path and reads nothing: a seat number is
 * already public on the board, and looking the holder up here would turn a
 * shareable card into a directory of registrants.
 *
 * `noindex`, because five hundred near-identical pages are not something a
 * search engine should carry — but the OpenGraph card still renders, which is
 * the only thing a shared link actually needs.
 */
export function GenesisSeatPage({
  locale,
  no,
}: {
  locale: Locale;
  no: string;
}) {
  const t = getGenesis(locale);
  const value = Number(no);

  // Anything outside the cohort is not a seat, and rendering it would invent one.
  if (!Number.isInteger(value) || value < 1 || value > SEATS) notFound();

  return (
    <div className="gx">
      <div className="gx__wrap">
        <div className="gx__top">
          <a className="lg__back" href={pathFor(locale)}>
            ← teslam.io
          </a>
          <p className="gx__eyebrow">{t.seatPage.title}</p>
        </div>

        <SeatCluster
          value={value}
          label={t.confirm.seatLabel}
          suffix={t.confirm.seatOf}
        />

        <p className="gx__lede">{t.seatPage.note}</p>

        <div className="gx__actions">
          <a className="gx__btn" href={genesisPathFor(locale)}>
            {t.seatPage.join}
          </a>
        </div>

        <p className="gx__disc">{t.disclaimer}</p>
      </div>

      <div className="cm__wrap">
        <CFooter locale={locale} />
      </div>
    </div>
  );
}
