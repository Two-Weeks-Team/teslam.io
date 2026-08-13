import { genesisPathFor, getModel, type Locale } from "@/lib/i18n";

export function Cta({ locale }: { locale: Locale }) {
  const t = getModel(locale).cta;

  return (
    <section className="cta" id="genesis">
      <p className="cta__eyebrow">{t.eyebrow}</p>
      <h2 className="cta__h2">{t.h2}</h2>
      <p className="cta__b">{t.body}</p>
      <a
        className="cta__btn"
        href={genesisPathFor(locale)}
        rel="noopener noreferrer"
        target="_blank"
      >
        {t.button}
      </a>
      <p className="cta__n">{t.note}</p>
    </section>
  );
}
