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
 * argument turns on a figure near ₩3,000 — rounding to thousands would erase
 * the difference the page exists to show.
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

export function pct(locale: Locale, ratio: number, digits = 0): string {
  return new Intl.NumberFormat(tag(locale), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}
