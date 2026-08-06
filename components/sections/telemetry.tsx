import { Section } from "@/components/sections/section";
import { getModel, type Locale } from "@/lib/i18n";
import { krw, n, usd } from "@/lib/format";
import {
  apiKrwPerMonth,
  apiUsdPerDay,
  apiUsdPerMonth,
  signalsPerDay,
} from "@/lib/economics";

export function Telemetry({ locale }: { locale: Locale }) {
  const t = getModel(locale).telemetry;

  return (
    <Section id="telemetry" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="tele">
        <div className="panel">
          <p className="panel__h">{t.signalsTitle}</p>
          {t.signals.map((s) => (
            <div className="sig" key={s.code}>
              <span className="sig__c">{s.code}</span>
              <span className="sig__t">{s.t}</span>
              <span className="sig__d">{s.d}</span>
            </div>
          ))}
        </div>

        <div className="panel">
          <p className="panel__h">{t.notTitle}</p>
          <div className="nots">
            {t.not.map((x) => (
              <p className="not" key={x}>
                {x}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="costbox">
        <p className="costbox__h">{t.costTitle}</p>
        <p className="costbox__f">{t.costFormula}</p>
        <div className="costbox__row">
          <span className="costbox__item">
            <span className="costbox__v">{n(locale, signalsPerDay)}</span>
            <span className="costbox__l">{t.signalsPerDayLabel}</span>
          </span>
          <span className="costbox__item">
            <span className="costbox__v">{usd(locale, apiUsdPerDay, 3)}</span>
            <span className="costbox__l">{t.perDay}</span>
          </span>
          <span className="costbox__item">
            <span className="costbox__v">
              {usd(locale, apiUsdPerMonth)} · {krw(locale, apiKrwPerMonth)}
            </span>
            <span className="costbox__l">{t.perMonth}</span>
          </span>
        </div>
        <p className="costbox__n">{t.costNote}</p>
      </div>
    </Section>
  );
}
