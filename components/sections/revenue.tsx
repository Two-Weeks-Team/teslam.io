import { Section } from "@/components/sections/section";
import { getModel, type Locale } from "@/lib/i18n";
import revenueData from "@/data/revenue.json";

type Lines = ReturnType<typeof getModel>["revenue"]["lines"];

export function Revenue({ locale }: { locale: Locale }) {
  const t = getModel(locale).revenue;
  const lines = t.lines as Lines;

  return (
    <Section id="revenue" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="revs">
        {revenueData.lines.map(({ id }) => {
          const line = lines[id as keyof Lines];
          return (
            <article className="rev" key={id}>
              <div className="rev__top">
                <span className="rev__stage">{line.stage}</span>
                <span className="pill">{t.notContracted}</span>
              </div>
              <h3 className="rev__t">{line.t}</h3>
              <p className="rev__d">{line.d}</p>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
