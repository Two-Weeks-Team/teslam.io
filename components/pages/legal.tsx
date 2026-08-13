import {
  getLegal,
  legalPathFor,
  pathFor,
  type Locale,
  type LegalSlug,
} from "@/lib/i18n";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Renders either legal document from the same shape.
 *
 * Both pages are deliberately plain — no cards, no accent panels, no
 * collapsed sections. A privacy policy that has to be expanded to be read is
 * a policy written to not be read, and this one has a section (§2, what is
 * never collected) that is the whole reason the project can claim what it
 * claims.
 */
export function LegalPage({
  locale,
  slug,
}: {
  locale: Locale;
  slug: LegalSlug;
}) {
  const l = getLegal(locale);
  const doc = l[slug];
  const other: LegalSlug = slug === "privacy" ? "terms" : "privacy";
  const otherLabel = other === "privacy" ? l.navPrivacy : l.navTerms;

  return (
    <div className="lg">
      <article className="lg__wrap">
        <header className="lg__top">
          <a className="lg__back" href={pathFor(locale)}>
            ← {l.backToHome}
          </a>
          <h1 className="lg__h1">{doc.title}</h1>
          <p className="lg__stamp">
            {doc.updatedLabel} <time dateTime={doc.updated}>{doc.updated}</time>
          </p>
        </header>

        <p className="lg__lede">{doc.lede}</p>

        {doc.sections.map((s) => (
          <section className="lg__sec" key={s.h}>
            <h2 className="lg__h2">{s.h}</h2>
            {s.p ? <p className="lg__p">{s.p}</p> : null}
            {s.items ? (
              <ul className="lg__list">
                {s.items.map((item) => (
                  <li className="lg__li" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <footer className="lg__foot">
          <a href={legalPathFor(locale, other)}>{otherLabel}</a>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </footer>
      </article>
    </div>
  );
}
