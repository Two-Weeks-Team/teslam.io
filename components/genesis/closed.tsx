import { getGenesis, type Locale } from "@/lib/i18n";

/**
 * What stands where the form stands, while registration is closed.
 *
 * Not a disabled form and not a "coming soon" card. A disabled form still
 * describes fields nobody can fill, and a bare "coming soon" tells a visitor
 * nothing they can act on — so this says the one thing that is actually
 * useful: what will happen, in what order, and why it is not happening yet.
 *
 * The reason is stated plainly rather than softened into maintenance language.
 * The whole argument of this site is that its numbers are checkable; a site
 * that hides why its own form is shut has already spent that.
 */
export function GenesisClosed({ locale }: { locale: Locale }) {
  const t = getGenesis(locale).closed;

  return (
    <section className="gcl" aria-labelledby="gcl-h">
      <p className="gcl__tag">{t.tag}</p>
      <h2 className="gcl__h" id="gcl-h">
        {t.title}
      </h2>
      <p className="gcl__body">{t.body}</p>
      <p className="gcl__why">{t.why}</p>

      <ol className="gcl__steps">
        {t.next.map((step, i) => (
          <li className="gcl__step" key={step}>
            {/* The numbering is the content: these are three things that happen
                in this order, and the order is what a reader is being asked to
                trust. */}
            <span className="gcl__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="gcl__open">{t.seatsAllOpen}</p>
    </section>
  );
}
