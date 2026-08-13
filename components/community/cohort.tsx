"use client";

import { genesisPathFor, getContent, type Locale } from "@/lib/i18n";
import { n } from "@/lib/format";
import { useLive } from "@/components/community/live-provider";
import { Mark } from "@/components/community/mark";
import { Odometer } from "@/components/community/odometer";
import { SeatField } from "@/components/genesis/seat-field";

/**
 * Genesis 500, given the width it needs.
 *
 * This was a panel beside the headline, which meant the car was drawn about
 * three hundred pixels wide — small enough that a viewer had to be told it was
 * a car. It is now its own section, and the readout beside it is an instrument
 * cluster rather than a caption: an odometer for the count, the perks as three
 * short lines, and nothing else competing.
 *
 * The 500-square grid still ships inside `SeatField` as the fallback for a
 * reader without WebGL, and is still what the server renders.
 */
export function Cohort({ locale }: { locale: Locale }) {
  const t = getContent(locale);
  const { seats, taken, justTook, live, open, demo } = useLive();
  const left = seats - taken;

  return (
    <section className="coh" aria-labelledby="coh-h">
      <div className="coh__head">
        <p className="coh__eyebrow" id="coh-h">
          {live && !demo.playing ? <Mark locale={locale} kind="real" /> : null}
          {t.genesis.title}
        </p>
      </div>

      <div className="coh__body">
        <SeatField
          taken={taken}
          justSeat={justTook?.seatNo ?? null}
          label={`${t.genesis.seatGridLabel}: ${n(locale, taken)} / ${n(locale, seats)}`}
        >
          <div className="seats__grid" role="img" aria-label={t.genesis.seatGridLabel}>
            {Array.from({ length: seats }, (_, i) => (
              <span
                key={i}
                className={
                  justTook && i === justTook.seatNo - 1
                    ? "seat seat--on seat--new"
                    : i < taken
                      ? "seat seat--on"
                      : i === taken
                        ? "seat seat--you"
                        : "seat"
                }
              />
            ))}
          </div>
        </SeatField>

        <aside className="coh__side">
          <p className="coh__read">
            <Odometer value={taken} digits={3} tone="gold" />
            <span className="coh__of">/ {seats}</span>
          </p>
          <p className="coh__left">
            {taken === 0 ? t.genesis.empty : `${t.genesis.seatLeft} ${n(locale, left)}`}
          </p>

          <div className="coh__perks">
            {t.genesis.perks.map((p) => (
              <p className="coh__perk" key={p}>
                {p}
              </p>
            ))}
          </div>

          <a className="btn btn--mint btn--block" href={genesisPathFor(locale)}>
            {open ? t.genesis.cta : t.genesis.ctaClosed}
          </a>
        </aside>
      </div>
    </section>
  );
}
