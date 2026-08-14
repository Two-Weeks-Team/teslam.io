import type { Locale } from "@/lib/i18n";

const tag = (locale: Locale) => (locale === "ko" ? "ko-KR" : "en-US");

/** Plain number, grouped. */
export function n(locale: Locale, value: number, digits = 0): string {
  return new Intl.NumberFormat(tag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Won, rounded to whole units. Costs are quoted to the won because the whole
 * argument turns on a figure near ₩2,100 — rounding to thousands would erase
 * the difference the page exists to show, and it would flatten the ₩67 API
 * line into nothing at all.
 */
export function krw(locale: Locale, value: number): string {
  const body = n(locale, Math.round(value));
  return locale === "ko" ? `${body}원` : `₩${body}`;
}

/** Dollars, at the precision the Fleet API actually bills in. */
export function usd(locale: Locale, value: number, digits = 2): string {
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * "34초 전" / "34s ago", from a Unix timestamp.
 *
 * `Intl.RelativeTimeFormat` rather than a hand-rolled table, because the table
 * is where the plural rules and the Korean particle go wrong. Anything older
 * than a week becomes a date: "51주 전" is a worse answer than "2026-03-14"
 * for a reader trying to work out whether a thread is current.
 *
 * The caller passes `now` explicitly. A server-rendered "3분 전" that a client
 * re-renders as "5분 전" is a hydration mismatch, and reading the clock inside
 * this function is how that happens.
 */
export function ago(locale: Locale, at: number, now: number): string {
  const seconds = Math.max(0, Math.floor(now - at));
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });

  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
  ];

  let value = seconds;
  for (const [unit, size] of steps) {
    if (value < size) return rtf.format(-value, unit);
    value = Math.floor(value / size);
  }

  return new Intl.DateTimeFormat(tag(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at * 1000));
}

export function pct(locale: Locale, ratio: number, digits = 0): string {
  return new Intl.NumberFormat(tag(locale), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}
