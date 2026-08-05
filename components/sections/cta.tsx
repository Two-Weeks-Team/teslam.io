import { getContent, type Locale } from "@/lib/i18n";
import { WAITLIST_URL } from "@/lib/site";

export function Cta({ locale }: { locale: Locale }) {
  const t = getContent(locale).cta;

  return (
    <section className="cta" id="genesis">
      <p className="cta__eyebrow">{t.eyebrow}</p>
      <h2 className="cta__h2">{t.h2}</h2>
      <p className="cta__b">{t.body}</p>
      <a
        className="cta__btn"
        href={WAITLIST_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t.button}
      </a>
      <p className="cta__n">{t.note}</p>
    </section>
  );
}
