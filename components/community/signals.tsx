import { getContent, modelPathFor, type Locale } from "@/lib/i18n";
import { signalCount, samplingIntervalSeconds } from "@/lib/economics";
import model from "@/data/model.json";

/**
 * What the car sends, and what it does not.
 *
 * Harvested from alt6's "PROOF OF DRIVE" and alt3's control-room framing, which
 * both open on the same fact and which this site had only ever stated in prose:
 * four signals go up once a minute, exactly one of them decides what is earned,
 * and a parked car sends nothing at all.
 *
 * That last clause is the one worth drawing. Every telematics product a reader
 * has met tracks the car when it is standing still, and saying "we do not" in a
 * sentence reads as marketing. Showing the transmitter dark, next to the one
 * that is lit, is an argument.
 *
 * Server-rendered, no client state. The signal list comes from
 * `data/model.json` — the same file `/model` computes its costs from — so this
 * cannot name a signal the operating model does not collect, or miss one it
 * does.
 */
export function Signals({ locale }: { locale: Locale }) {
  const t = getContent(locale).signals;

  /*
   * The odometer is the one that pays. Everything else is a cross-check, and
   * the order here is the order `given.signals` lists them so a signal added
   * to the model appears here without anybody remembering to add it.
   */
  const signals = model.given.signals.map((id) => ({
    id,
    // Written out rather than sliced from the field name: three letters of
    // "vehicleSpeed" is VEH, which is not what anybody calls it.
    code: t.codes[id as keyof typeof t.codes] ?? id.slice(0, 3).toUpperCase(),
    label: t.names[id as keyof typeof t.names] ?? id,
    pays: id === "odometer",
  }));

  return (
    <section className="sig2" aria-labelledby="sig2-h">
      <div className="sig2__head">
        <p className="sig2__eyebrow">{t.eyebrow}</p>
        <h2 className="sig2__h" id="sig2-h">
          {t.title}
        </h2>
        <p className="sig2__sub">{t.sub}</p>
      </div>

      <div className="sig2__wire">
        <div className="sig2__end sig2__end--car">
          <p className="sig2__endl">{t.car}</p>
          <p className="sig2__ends">{t.moving}</p>
        </div>

        <ol className="sig2__lanes" aria-label={t.title}>
          {signals.map((s) => (
            <li
              className={s.pays ? "sig2__lane is-pay" : "sig2__lane"}
              key={s.id}
            >
              <span className="sig2__code">{s.code}</span>
              <span className="sig2__name">{s.label}</span>
              <span className="sig2__role">{s.pays ? t.pays : t.checks}</span>
            </li>
          ))}
        </ol>

        <div className="sig2__end sig2__end--us">
          <p className="sig2__endl">teslam.io</p>
          <p className="sig2__ends">
            {samplingIntervalSeconds}
            {t.everySeconds}
          </p>
        </div>
      </div>

      <div className="sig2__pair">
        <article className="sig2__card">
          <p className="sig2__ct">{t.parked.title}</p>
          <p className="sig2__cb">{t.parked.body}</p>
        </article>
        {/* The photograph goes behind this one and no other: it is a picture
            of the exact number the sentence is about. Generated and unbranded,
            because a real manufacturer's dashboard here would contradict the
            footer on every page. */}
        <article className="sig2__card sig2__card--odo">
          <p className="sig2__ct">{t.oneWay.title}</p>
          <p className="sig2__cb">{t.oneWay.body}</p>
        </article>
      </div>

      <p className="sig2__foot">
        {t.foot.replace("{n}", String(signalCount))}{" "}
        <a href={modelPathFor(locale)}>{t.footLink}</a>
      </p>
    </section>
  );
}
