import { Cluster } from "@/components/hero/cluster";
import { getModel, type Locale } from "@/lib/i18n";

export function Hero({ locale }: { locale: Locale }) {
  const t = getModel(locale).hero;

  return (
    <header className="hero">
      <p className="hero__eyebrow">{t.eyebrow}</p>
      <h1 className="hero__h1">{t.h1}</h1>
      <p className="hero__sub">{t.sub}</p>

      <dl className="hero__stats">
        {t.stats.map((s) => (
          <div className="hero__stat" key={s.label}>
            <dt className="hero__statl">{s.label}</dt>
            <dd className="hero__statv">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Cluster locale={locale} />
    </header>
  );
}
