import { Section } from "@/components/sections/section";
import { getContent, type Locale } from "@/lib/i18n";

export function How({ locale }: { locale: Locale }) {
  const t = getContent(locale).how;

  return (
    <Section id="how" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <ol className="steps">
        {t.steps.map((s) => (
          <li className="step" key={s.k}>
            <p className="step__k">{s.k}</p>
            <h3 className="step__t">{s.t}</h3>
            <p className="step__d">{s.d}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
