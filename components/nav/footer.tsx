import { getContent, type Locale } from "@/lib/i18n";
import { CONTACT_EMAIL, REPO } from "@/lib/site";
import { capturedAt } from "@/lib/economics";

/**
 * The two disclaimers are not boilerplate and are not in a collapsed panel.
 *
 * This site carries a name one letter from a car maker's and describes a token
 * that does not exist yet. Both facts belong in front of the reader, in the
 * same type size as everything else here.
 */
export function Footer({ locale }: { locale: Locale }) {
  const t = getContent(locale).footer;
  const year = 2026;

  return (
    <footer className="foot">
      <hr className="rule" />
      <div className="foot__grid">
        <div>
          <p className="foot__mark">teslam.io</p>
          <p className="foot__line">{t.line}</p>
        </div>

        <div>
          <p className="foot__h">{t.contactLabel}</p>
          <a className="foot__a" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <div>
          <p className="foot__h">{t.repoLabel}</p>
          <a className="foot__a" href={REPO} rel="noopener">
            github.com/Two-Weeks-Team
          </a>
          <a className="foot__a" href="/llms.txt">
            /llms.txt
          </a>
        </div>
      </div>

      <div className="foot__legal">
        <p className="foot__disc">{t.disclaimerTrademark}</p>
        <p className="foot__disc">{t.disclaimerFinancial}</p>
      </div>

      <div className="foot__bot">
        <span>
          © {year} {t.rights}
        </span>
        <span>
          {t.snapshot} <time dateTime={capturedAt}>{capturedAt}</time>
        </span>
      </div>
    </footer>
  );
}
