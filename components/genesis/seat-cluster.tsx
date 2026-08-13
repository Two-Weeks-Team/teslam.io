/**
 * The seat number, rendered as an odometer.
 *
 * This is the moment the whole registration exists for. Everything before it is
 * a form; this is the thing someone screenshots. So it is built like the
 * instrument it borrows from — amber digits behind glass, each one a strip of
 * 0–9 rolled into place — rather than as a number in a box.
 *
 * The roll is CSS only. No JavaScript runs to animate it, which means it works
 * in a screenshot service, in an email client's preview, and with scripting off
 * — all places this image is likely to end up.
 *
 * Digits are borrowed from the mechanical odometer in `/alt7`, one of the ten
 * design directions kept under `public/`. That file is untouched: this is a
 * reimplementation of the idea in the site's own tokens, not a copy of it.
 */
export function SeatCluster({
  value,
  label,
  suffix,
  tone = "seat",
}: {
  value: number;
  label: string;
  suffix?: string;
  tone?: "seat" | "waitlist";
}) {
  // Three columns for a 500-seat cohort; a waitlist position may need four.
  const digits = String(value).padStart(value > 999 ? 4 : 3, "0").split("");

  return (
    <div className={`sc sc--${tone}`}>
      <div className="sc__glass">
        <p className="sc__label">{label}</p>

        <div
          className="sc__digits"
          role="img"
          aria-label={`${label} ${value}${suffix ? ` ${suffix}` : ""}`}
        >
          {digits.map((d, i) => (
            <span className="sc__cell" key={i} aria-hidden="true">
              <span
                className="sc__strip"
                // Each column is one character tall with the rest clipped, so
                // shifting by N ems selects the digit. The transition on mount
                // is what produces the roll.
                style={{
                  transform: `translateY(-${Number(d)}em)`,
                  transitionDelay: `${i * 90}ms`,
                }}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <i key={n}>{n}</i>
                ))}
              </span>
            </span>
          ))}
        </div>

        {suffix ? <p className="sc__suffix">{suffix}</p> : null}

        <span className="sc__scan" aria-hidden="true" />
      </div>
    </div>
  );
}
