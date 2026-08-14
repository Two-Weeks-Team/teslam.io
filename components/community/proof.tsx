import { getContent, genesisPathFor, modelPathFor, type Locale } from "@/lib/i18n";
import { cappedKmPerDay, drvPerKm } from "@/lib/economics";
import { n } from "@/lib/format";

/**
 * Why the numbers can be believed, and how to get on the board.
 *
 * Harvested from alt6 and alt7, which both open on the same argument and which
 * this site had reduced to a single line in the hero. It is the whole
 * differentiator: anyone can build a leaderboard, and anyone can win one by
 * driving a GPS trace round a car park. An odometer reading pulled from the car
 * cannot be walked, spoofed or replayed, which is what makes a league worth
 * entering and a reward worth paying.
 *
 * Both blocks are server-rendered with no client state. They are an argument,
 * not an instrument, and an argument that needs JavaScript to appear is one a
 * crawler and a reader on a slow connection never see.
 */

export function Proof({ locale }: { locale: Locale }) {
  const t = getContent(locale).proof;

  return (
    <section className="pf" aria-labelledby="pf-h">
      <div className="pf__head">
        <p className="pf__eyebrow">{t.eyebrow}</p>
        <h2 className="pf__h" id="pf-h">
          {t.title}
        </h2>
        <p className="pf__sub">{t.sub}</p>
      </div>

      <div className="pf__pair">
        {/* Side by side on purpose: the claim only lands as a comparison. */}
        <article className="pf__side pf__side--bad">
          <p className="pf__tag">{t.gps.tag}</p>
          <p className="pf__claim">{t.gps.claim}</p>
          <ul className="pf__list">
            {t.gps.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="pf__side pf__side--good">
          <p className="pf__tag">{t.odo.tag}</p>
          <p className="pf__claim">{t.odo.claim}</p>
          <ul className="pf__list">
            {t.odo.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="pf__foot">
        {t.foot}{" "}
        <a href={modelPathFor(locale)}>{t.footLink}</a>
      </p>
    </section>
  );
}

/**
 * The three steps between reading this and being on the board.
 *
 * The site could argue for the product and never say how to start it. The
 * numbers in step three are the real ones — `cappedKmPerDay` and `drvPerKm`
 * come from `lib/economics`, so this cannot promise a rate the operating model
 * does not.
 */
export function Onboard({ locale }: { locale: Locale }) {
  const t = getContent(locale).onboard;

  const steps = [
    { n: 1, ...t.steps[0] },
    { n: 2, ...t.steps[1] },
    {
      n: 3,
      title: t.steps[2].title,
      body: t.steps[2].body
        .replace("{km}", n(locale, Math.round(cappedKmPerDay)))
        .replace("{drv}", n(locale, Math.round(cappedKmPerDay * drvPerKm))),
    },
  ];

  return (
    <section className="ob" aria-labelledby="ob-h">
      <div className="ob__head">
        <p className="ob__eyebrow">{t.eyebrow}</p>
        <h2 className="ob__h" id="ob-h">
          {t.title}
        </h2>
        <p className="ob__sub">{t.sub}</p>
      </div>

      <ol className="ob__steps">
        {steps.map((step) => (
          <li className="ob__step" key={step.n}>
            <span className="ob__n" aria-hidden="true">
              {step.n}
            </span>
            <div>
              <p className="ob__t">{step.title}</p>
              <p className="ob__b">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="ob__cta">
        <a className="btn btn--mint" href={genesisPathFor(locale)}>
          {t.cta}
        </a>
        <p className="ob__note">{t.note}</p>
      </div>
    </section>
  );
}
