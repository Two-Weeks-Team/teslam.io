import { Section } from "@/components/sections/section";
import { getModel, type Locale } from "@/lib/i18n";
import { krw, pct } from "@/lib/format";
import {
  burnedKrwPerMonth,
  cashRedeemedKrwPerMonth,
  commissionRecoveredKrwPerMonth,
  deferredKrwPerMonth,
  netRewardKrwPerMonth,
  rewardKrwPerMonth,
} from "@/lib/economics";
import type { LiveFigures } from "@/lib/economics";

/*
 * The imports above are the reward side of the ledger, which is pegged in won
 * and does not move with the dollar. Everything that does move arrives as
 * `live`, derived from the rate quoted for this request.
 */

/** Marks a row whose input has not been validated against a real fleet. */
function Assumed({ label }: { label: string }) {
  return <span className="tag tag--assumed">{label}</span>;
}

/**
 * The section the site exists for.
 *
 * The brief this was built from treats the Fleet API bill as the constraint.
 * The ledger below is that brief's own arithmetic carried one step further,
 * and it lands somewhere else: the API is about a third of what carrying a
 * vehicle actually costs. Saying so is more useful than quoting the smaller
 * number, so the smaller number is shown next to the real one rather than
 * instead of it.
 */
export function Economics({
  locale,
  live,
}: {
  locale: Locale;
  live: LiveFigures;
}) {
  const t = getModel(locale).economics;
  const r = t.rows;

  return (
    <Section id="economics" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="ledger">
        <table className="ledger__t">
          <caption className="ledger__cap">{t.ledgerTitle}</caption>
          <tbody>
            <tr>
              <th scope="row" className="ledger__k">
                {r.api.k}
                <span className="ledger__d"> · {r.api.d}</span>
              </th>
              <td className="ledger__v">{krw(locale, live.apiKrwPerMonth)}</td>
            </tr>

            <tr>
              <th scope="row" className="ledger__k">
                {r.issued.k}
                <span className="ledger__d"> · {r.issued.d}</span>
                <Assumed label={t.assumedTag} />
              </th>
              <td className="ledger__v">{krw(locale, rewardKrwPerMonth)}</td>
            </tr>

            <tr className="ledger__row--sub ledger__row--free">
              <th scope="row" className="ledger__k">
                {r.burned.k}
                <span className="ledger__d"> · {r.burned.d}</span>
              </th>
              <td className="ledger__v">−{krw(locale, burnedKrwPerMonth)}</td>
            </tr>

            <tr className="ledger__row--sub ledger__row--free">
              <th scope="row" className="ledger__k">
                {r.deferred.k}
                <span className="ledger__d"> · {r.deferred.d}</span>
              </th>
              <td className="ledger__v">−{krw(locale, deferredKrwPerMonth)}</td>
            </tr>

            <tr className="ledger__row--sub">
              <th scope="row" className="ledger__k">
                {r.cash.k}
                <span className="ledger__d"> · {r.cash.d}</span>
              </th>
              <td className="ledger__v">
                {krw(locale, cashRedeemedKrwPerMonth)}
              </td>
            </tr>

            <tr className="ledger__row--sub">
              <th scope="row" className="ledger__k">
                {r.commission.k}
                <span className="ledger__d"> · {r.commission.d}</span>
                <Assumed label={t.assumedTag} />
              </th>
              <td className="ledger__v">
                −{krw(locale, commissionRecoveredKrwPerMonth)}
              </td>
            </tr>

            <tr>
              <th scope="row" className="ledger__k">
                {r.net.k}
                <span className="ledger__d"> · {r.net.d}</span>
              </th>
              <td className="ledger__v">{krw(locale, netRewardKrwPerMonth)}</td>
            </tr>

            <tr className="ledger__row--total">
              <th scope="row" className="ledger__k">
                {r.total.k}
                <span className="ledger__d"> · {r.total.d}</span>
              </th>
              <td className="ledger__v">
                {krw(locale, live.cashCostPerVehicleMonth)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="split">
        <div className="big">
          <p className="big__h">{t.shareNote}</p>
          <p className="big__v">{pct(locale, live.apiShareOfCashCost)}</p>
          <p className="big__n">{t.rows.api.d}</p>
        </div>
        <div className="big big--volt">
          <p className="big__h">{t.breakevenTitle}</p>
          <p className="big__v">
            {krw(locale, live.breakevenKrwPerVehicleMonth)}
          </p>
          <p className="big__n">{t.breakevenNote}</p>
        </div>
      </div>

      <h3 className="big__h" style={{ marginBlockStart: "2.5rem" }}>
        {t.genesisTitle}
      </h3>
      <div className="compare">
        <div className="compare__cell">
          <p className="compare__l">{t.genesisQuoted}</p>
          <p className="compare__v">{krw(locale, live.genesisApiKrwPerMonth)}</p>
        </div>
        <div className="compare__cell compare__cell--true">
          <p className="compare__l">{t.genesisTrue}</p>
          <p className="compare__v">{krw(locale, live.genesisTotalKrwPerMonth)}</p>
        </div>
      </div>
      <p className="mix__n">{t.genesisNote}</p>
    </Section>
  );
}
