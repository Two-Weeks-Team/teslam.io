import { Hero } from "@/components/hero/hero";
import { Header } from "@/components/nav/header";
import { Footer } from "@/components/nav/footer";
import { How } from "@/components/sections/how";
import { Telemetry } from "@/components/sections/telemetry";
import { Tokens } from "@/components/sections/tokens";
import { Sinks } from "@/components/sections/sinks";
import { Economics } from "@/components/sections/economics";
import { Revenue } from "@/components/sections/revenue";
import { Roadmap } from "@/components/sections/roadmap";
import { Integrity } from "@/components/sections/integrity";
import { Cta } from "@/components/sections/cta";
import { JsonLd } from "@/components/jsonld";
import type { Locale } from "@/lib/i18n";
import { deriveAt } from "@/lib/economics";
import { getFx } from "@/lib/fx";

/**
 * One page, both locales.
 *
 * The order is an argument, not a menu: what it is → what it takes from you →
 * what you get → why that does not collapse → what it costs to run → what pays
 * for it → when it opens → why the driving is believable.
 *
 * The exchange rate is quoted once, here, and handed to both sections that
 * spend it. Fetching it twice would risk two sections disagreeing about the
 * same cost inside one page.
 */
export async function ModelPage({ locale }: { locale: Locale }) {
  const fx = await getFx();
  const live = deriveAt(fx.rate);

  return (
    <>
      <JsonLd locale={locale} />
      <Header locale={locale} />
      <Hero locale={locale} />
      <main className="wrap">
        <How locale={locale} />
        <Telemetry locale={locale} fx={fx} live={live} />
        <Tokens locale={locale} />
        <Sinks locale={locale} />
        <Economics locale={locale} live={live} />
        <Revenue locale={locale} />
        <Roadmap locale={locale} />
        <Integrity locale={locale} />
        <Cta locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
