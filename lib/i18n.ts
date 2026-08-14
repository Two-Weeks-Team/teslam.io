import { home as koHome } from "@/content/ko/home";
import { home as enHome } from "@/content/en/home";
import { model as koModel } from "@/content/ko/model";
import { model as enModel } from "@/content/en/model";
import { legal as koLegal } from "@/content/ko/legal";
import { genesis as koGenesis } from "@/content/ko/genesis";
import { legal as enLegal } from "@/content/en/legal";
import { genesis as enGenesis } from "@/content/en/genesis";
import type { HomeContent } from "@/content/ko/home";
import type { ModelContent } from "@/content/ko/model";
import type { LegalContent } from "@/content/ko/legal";
import type { GenesisContent } from "@/content/ko/genesis";
import { SITE } from "@/lib/site";

export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Korean is the default: the fleet this is being built for is in Korea. */
export const DEFAULT_LOCALE: Locale = "ko";

const HOME: Record<Locale, HomeContent> = { ko: koHome, en: enHome };
const MODEL: Record<Locale, ModelContent> = { ko: koModel, en: enModel };
const LEGAL: Record<Locale, LegalContent> = { ko: koLegal, en: enLegal };
const GENESIS: Record<Locale, GenesisContent> = { ko: koGenesis, en: enGenesis };

/** The community front page — the shrine. */
export function getContent(locale: Locale): HomeContent {
  return HOME[locale];
}

/**
 * The operating model, at `/model`. It is a different document for a different
 * reader — a partner or an insurer, not an owner — so it keeps its own content
 * module rather than being folded into the front page.
 */
export function getModel(locale: Locale): ModelContent {
  return MODEL[locale];
}

/** Canonical path for a locale. Korean lives at the root. */
export function pathFor(locale: Locale): string {
  return locale === "ko" ? "/" : `/${locale}`;
}

/** Canonical path for the model page in a locale. */
export function modelPathFor(locale: Locale): string {
  return locale === "ko" ? "/model" : "/en/model";
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

/**
 * The privacy policy and terms.
 *
 * These exist before the registration form does, not after it. A policy
 * written once personal data is already arriving is a description of a fait
 * accompli rather than a commitment.
 */
export function getLegal(locale: Locale): LegalContent {
  return LEGAL[locale];
}

/** Copy for the registration flow. */
export function getGenesis(locale: Locale): GenesisContent {
  return GENESIS[locale];
}

/** The registration flow. Korean lives at the root, as everything else does. */
export function genesisPathFor(locale: Locale): string {
  return locale === "ko" ? "/genesis" : "/en/genesis";
}

export function genesisConfirmPathFor(locale: Locale): string {
  return `${genesisPathFor(locale)}/confirm`;
}

export function boardPathFor(locale: Locale): string {
  return locale === "ko" ? "/board" : "/en/board";
}

export function postAlternatesFor(locale: Locale, id: string) {
  return {
    canonical: `${SITE}${boardPathFor(locale)}/${id}`,
    languages: {
      ko: `${SITE}/board/${id}`,
      en: `${SITE}/en/board/${id}`,
      "x-default": `${SITE}/board/${id}`,
    },
  };
}

export type LegalSlug = "privacy" | "terms";

export function legalPathFor(locale: Locale, slug: LegalSlug): string {
  return locale === "ko" ? `/${slug}` : `/en/${slug}`;
}

export function legalAlternatesFor(locale: Locale, slug: LegalSlug) {
  return {
    canonical: `${SITE}${legalPathFor(locale, slug)}`,
    languages: {
      ko: `${SITE}/${slug}`,
      en: `${SITE}/en/${slug}`,
      "x-default": `${SITE}/${slug}`,
    },
  };
}

export function modelAlternatesFor(locale: Locale) {
  return {
    canonical: `${SITE}${modelPathFor(locale)}`,
    languages: {
      ko: `${SITE}/model`,
      en: `${SITE}/en/model`,
      "x-default": `${SITE}/model`,
    },
  };
}

export { SITE };
