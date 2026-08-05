import { getContent, pathFor, type Locale } from "@/lib/i18n";
import { SITE, CONTACT_EMAIL } from "@/lib/site";

/**
 * Organization plus WebSite. Deliberately no Product or Offer markup: nothing
 * here is for sale, no token has been issued, and marking this up as an
 * offering would be a claim the project cannot support.
 */
export function JsonLd({ locale }: { locale: Locale }) {
  const t = getContent(locale);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: "teslam.io",
        url: SITE,
        email: CONTACT_EMAIL,
        description: t.meta.description,
        // Stated in structured data as well as in the footer, so an aggregator
        // reading only the markup still gets the affiliation right.
        disambiguatingDescription: t.footer.disclaimerTrademark,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#site`,
        url: `${SITE}${pathFor(locale)}`,
        name: "teslam.io",
        inLanguage: locale === "ko" ? "ko-KR" : "en",
        publisher: { "@id": `${SITE}/#org` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Content is a build-time constant from typed modules; there is no user
      // input anywhere in this tree.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
