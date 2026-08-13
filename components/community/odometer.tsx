"use client";

/**
 * A number that rolls rather than snaps.
 *
 * Each digit is a strip of 0–9 slid into place, so a count going from 137 to
 * 138 moves one column instead of repainting a label. That is the difference
 * between a readout and a number in a box, and on a car community's board the
 * instrument-cluster reading is the right one.
 *
 * The whole thing is one accessible label. Announcing ten digit strips to a
 * screen reader would be ten pieces of noise standing in for one fact.
 */
export function Odometer({
  value,
  digits,
  tone = "volt",
}: {
  value: number;
  digits: number;
  tone?: "volt" | "gold";
}) {
  const text = String(Math.max(0, Math.floor(value))).padStart(digits, "0");
  const shown = text.slice(-digits);

  return (
    <span
      className={`odo odo--${tone}`}
      role="img"
      aria-label={String(value)}
    >
      {shown.split("").map((digit, i) => (
        <span className="odo__col" key={i} aria-hidden="true">
          <span
            className="odo__strip"
            // Ten digits stacked; the strip slides by whole digit-heights.
            style={{ transform: `translateY(${-Number(digit) * 10}%)` }}
          >
            {"0123456789".split("").map((d) => (
              <span className="odo__d" key={d}>
                {d}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
