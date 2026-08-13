import { GenesisConfirm } from "@/components/genesis/confirm";
import { CFooter } from "@/components/community/footer";
import { getGenesis, type Locale } from "@/lib/i18n";

/**
 * The confirmation page.
 *
 * Deliberately thin. Everything on it depends on a token that only exists in
 * the URL the reader arrived with, so there is nothing to render on the server
 * and nothing worth indexing — the route is `noindex`, and a crawler that finds
 * it sees the same "arrive through the link" message a person would.
 */
export function GenesisConfirmPage({ locale }: { locale: Locale }) {
  const t = getGenesis(locale);

  return (
    <div className="gx">
      <div className="gx__wrap">
        <GenesisConfirm locale={locale} />
        <p className="gx__disc">{t.disclaimer}</p>
      </div>

      <div className="cm__wrap">
        <CFooter locale={locale} />
      </div>
    </div>
  );
}
