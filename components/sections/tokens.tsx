import { Section } from "@/components/sections/section";
import { getContent, type Locale } from "@/lib/i18n";

export function Tokens({ locale }: { locale: Locale }) {
  const t = getContent(locale).tokens;

  return (
    <Section id="tokens" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="toks">
        {[
          { d: t.drv, mod: "tok tok--drv" },
          { d: t.tslm, mod: "tok" },
        ].map(({ d, mod }) => (
          <article className={mod} key={d.name}>
            <p className="tok__tag">{d.tag}</p>
            <h3 className="tok__name">{d.name}</h3>
            <p className="tok__full">{d.full}</p>
            <p className="tok__d">{d.d}</p>
            <dl className="tok__rows">
              {d.rows.map((r) => (
                <div className="tok__row" key={r.k}>
                  <dt className="tok__k">{r.k}</dt>
                  <dd className="tok__v">{r.v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="flow">
        <p className="flow__h">{t.flowTitle}</p>
        <div className="flow__chain">
          <span className="flow__node">{t.flow.source}</span>
          <span className="flow__arr" aria-hidden="true">
            →
          </span>
          <span className="flow__node">{t.flow.verify}</span>
          <span className="flow__arr" aria-hidden="true">
            →
          </span>
          <span className="flow__node flow__node--mint">{t.flow.mint}</span>
        </div>
        <div className="flow__outs">
          {t.flow.outs.map((o) => (
            <div className="flow__out" key={o.t}>
              <p className="flow__outt">{o.t}</p>
              <p className="flow__outd">{o.d}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
