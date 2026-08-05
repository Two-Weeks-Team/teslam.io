import { Section } from "@/components/sections/section";
import { getContent, type Locale } from "@/lib/i18n";
import { pct } from "@/lib/format";
import { redemptionMix } from "@/lib/economics";
import sinkData from "@/data/sinks.json";

type Kind = "cash" | "burn" | "defer";
type Items = ReturnType<typeof getContent>["sinks"]["items"];

export function Sinks({ locale }: { locale: Locale }) {
  const t = getContent(locale).sinks;
  const items = t.items as Items;

  const byKind = (k: Kind) =>
    sinkData.sinks.filter((s) => s.kind === k) as { id: keyof Items }[];

  const order: Kind[] = ["cash", "burn", "defer"];

  return (
    <Section id="sinks" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="sinks">
        {order.map((k) => (
          <div className={`sinkcol sinkcol--${k}`} key={k}>
            <h3 className="sinkcol__t">{t.kinds[k].t}</h3>
            <p className="sinkcol__d">{t.kinds[k].d}</p>
            <div className="sinkcol__items">
              {byKind(k).map((s) => (
                <div className="sinkitem" key={s.id}>
                  <p className="sinkitem__t">{items[s.id].t}</p>
                  <p className="sinkitem__d">{items[s.id].d}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mix">
        <div className="mix__h">
          <span>{t.mixTitle}</span>
        </div>
        <div
          className="mix__bar"
          role="img"
          aria-label={`${t.cashLabel} ${pct(locale, redemptionMix.cashBacked)}, ${t.burnLabel} ${pct(locale, redemptionMix.burnedInApp)}, ${t.stakeLabel} ${pct(locale, redemptionMix.stakedToTslm)}`}
        >
          <span
            className="mix__seg mix__seg--cash"
            style={{ flexBasis: `${redemptionMix.cashBacked * 100}%` }}
          />
          <span
            className="mix__seg mix__seg--burn"
            style={{ flexBasis: `${redemptionMix.burnedInApp * 100}%` }}
          />
          <span
            className="mix__seg mix__seg--stake"
            style={{ flexBasis: `${redemptionMix.stakedToTslm * 100}%` }}
          />
        </div>
        <div className="mix__keys">
          <span className="mix__key">
            <span
              className="mix__swatch mix__seg--cash"
              aria-hidden="true"
            />
            {t.cashLabel} {pct(locale, redemptionMix.cashBacked)}
          </span>
          <span className="mix__key">
            <span
              className="mix__swatch mix__seg--burn"
              aria-hidden="true"
            />
            {t.burnLabel} {pct(locale, redemptionMix.burnedInApp)}
          </span>
          <span className="mix__key">
            <span
              className="mix__swatch mix__seg--stake"
              aria-hidden="true"
            />
            {t.stakeLabel} {pct(locale, redemptionMix.stakedToTslm)}
          </span>
        </div>
        <p className="mix__n">{t.mixNote}</p>
      </div>
    </Section>
  );
}
