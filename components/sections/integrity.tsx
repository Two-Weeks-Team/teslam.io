import { Section } from "@/components/sections/section";
import { getContent, type Locale } from "@/lib/i18n";

export function Integrity({ locale }: { locale: Locale }) {
  const t = getContent(locale).integrity;

  return (
    <Section id="integrity" eyebrow={t.eyebrow} h2={t.h2} lede={t.lede}>
      <div className="checks">
        {t.checks.map((c) => (
          <div className="check" key={c.t}>
            <h3 className="check__t">{c.t}</h3>
            <p className="check__d">{c.d}</p>
          </div>
        ))}
      </div>

      <div className="privacy">
        <p className="privacy__h">{t.privacyTitle}</p>
        <p className="privacy__d">{t.privacyNote}</p>
      </div>
    </Section>
  );
}
