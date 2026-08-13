import {
  getContent,
  getLegal,
  legalPathFor,
  modelPathFor,
  type Locale,
} from "@/lib/i18n";
import { CONTACT_EMAIL, REPO } from "@/lib/site";
import cm from "@/data/community.json";

/**
 * The two disclaimers are not boilerplate and are not collapsed.
 *
 * This site carries a name one letter from a car maker's, describes a token
 * that does not exist yet, and currently shows sample activity. All three
 * facts belong in front of the reader.
 */
export function CFooter({ locale }: { locale: Locale }) {
  const t = getContent(locale).footer;
  const l = getLegal(locale);

  return (
    <footer className="cmfoot">
      <div className="cmfoot__g">
        <div>
          <p className="cmfoot__m">teslam.io</p>
          <p className="cmfoot__l">{t.line}</p>
        </div>
        <div>
          <p className="cmfoot__h">{t.contactLabel}</p>
          <a className="cmfoot__a" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <a className="cmfoot__a" href={modelPathFor(locale)}>
            {t.modelLabel}
          </a>
        </div>
        <div>
          <p className="cmfoot__h">{t.repoLabel}</p>
          <a className="cmfoot__a" href={REPO} rel="noopener">
            github.com/Two-Weeks-Team
          </a>
          <a className="cmfoot__a" href="/llms.txt">
            /llms.txt
          </a>
          <a className="cmfoot__a" href={legalPathFor(locale, "privacy")}>
            {l.navPrivacy}
          </a>
          <a className="cmfoot__a" href={legalPathFor(locale, "terms")}>
            {l.navTerms}
          </a>
        </div>
      </div>

      <div className="cmfoot__legal">
        <p className="cmfoot__d">{t.disclaimerTrademark}</p>
        <p className="cmfoot__d">{t.disclaimerFinancial}</p>
      </div>

      <div className="cmfoot__bot">
        <span>© 2026 {t.rights}</span>
        <span>
          {t.snapshot}{" "}
          <time dateTime={cm.capturedAt}>{cm.capturedAt}</time>
        </span>
      </div>
    </footer>
  );
}
