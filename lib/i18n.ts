import { home as ko } from "@/content/ko/home";
import { home as en } from "@/content/en/home";
import type { HomeContent } from "@/content/ko/home";
import { SITE } from "@/lib/site";

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Korean is the default: the fleet this is being built for is in Korea. */
export const DEFAULT_LOCALE: Locale = "ko";

const DICT: Record<Locale, HomeContent> = { ko, en };

export function getContent(locale: Locale): HomeContent {
  return DICT[locale];
}

/** Canonical path for a locale. Korean lives at the root. */
export function pathFor(locale: Locale): string {
  return locale === "ko" ? "/" : `/${locale}`;
}

/**
 * hreflang for both locales plus x-default, which points at Korean.
 *
 * There is deliberately no Accept-Language redirect: a crawler and a person
 * must land on the same document, and an automatic redirect makes x-default
 * meaningless.
 */
export function alternatesFor(locale: Locale) {
  return {
    canonical: `${SITE}${pathFor(locale)}`,
    languages: {
      ko: `${SITE}/`,
      en: `${SITE}/en`,
      "x-default": `${SITE}/`,
    },
  };
}

export { SITE };
