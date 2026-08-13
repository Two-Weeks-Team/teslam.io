import { GenesisClosed } from "@/components/genesis/closed";
import { GenesisForm } from "@/components/genesis/form";
import { CFooter } from "@/components/community/footer";
import { getGenesis, pathFor, type Locale } from "@/lib/i18n";
import { getGenesisStats } from "@/lib/stats";
import { n } from "@/lib/format";

/**
 * The registration page.
 *
 * Order: what this is, how many seats are gone, the form, then what is not
 * being asked for. The last section is placed after the form on purpose — a
 * reader who has just typed their address is exactly the person who wants to
 * know what else was taken, and the answer is nothing.
 */
export async function GenesisPage({ locale }: { locale: Locale }) {
  const t = getGenesis(locale);
  const stats = await getGenesisStats();

  return (
    <div className="gx">
      <div className="gx__wrap">
        <div className="gx__top">
          <a className="lg__back" href={pathFor(locale)}>
            ← teslam.io
          </a>
          <p className="gx__eyebrow">{t.eyebrow}</p>
          <h1 className="gx__h1">{t.title}</h1>
          <p className="gx__lede">{t.lede}</p>
        </div>

        {/*
          When the API cannot be reached the figure is not a measurement, and
          saying so costs one line. On day one the honest count and the fallback
          are both zero — which is exactly when it is easiest to let a broken
          reading pass for a real one, and hardest to notice later.
        */}
        {stats.live ? null : <p className="gf__err">{t.countStale}</p>}

        <p className="gx__count">
          <b>{n(locale, stats.taken)}</b>
          <span>
            {t.ofSeats} · {t.seatsLabel}
          </span>
        </p>

        {/*
          The Worker decides this, not the page. Drawing the form from a local
          guess would eventually disagree with the endpoint, and the visitor who
          meets that disagreement meets it as a form that submits into a 503.
        */}
        {stats.open ? (
          <GenesisForm locale={locale} />
        ) : (
          <GenesisClosed locale={locale} />
        )}

        <section className="gx__not">
          <h2>{t.notCollected.title}</h2>
          <ul>
            {t.notCollected.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <p className="gx__disc">{t.disclaimer}</p>
      </div>

      <div className="cm__wrap">
        <CFooter locale={locale} />
      </div>
    </div>
  );
}
