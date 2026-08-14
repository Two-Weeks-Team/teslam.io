import { notFound } from "next/navigation";
import { Bar } from "@/components/community/bar";
import { CFooter } from "@/components/community/footer";
import { Thread } from "@/components/community/thread";
import { SessionProvider } from "@/components/community/session";
import { LiveProvider } from "@/components/community/live-provider";
import { getPost } from "@/lib/posts";
import { getGenesisStats } from "@/lib/stats";
import { type Locale } from "@/lib/i18n";

/**
 * One post, on its own page.
 *
 * A board whose threads have no address is a board nobody can link to, and a
 * link somebody can send is most of why a community post is worth writing. The
 * post is fetched on the server so the URL returns the discussion to a crawler,
 * a preview card and a reader with scripts off.
 *
 * `LiveProvider` is here because the top bar reads the seat count from it. That
 * is not a decoration: without the provider `useLive` throws, and the route is
 * a runtime error rather than a page missing a number — which is precisely what
 * happened, and which the server-rendered HTML looked fine throughout.
 */
export async function PostPage({ locale, id }: { locale: Locale; id: string }) {
  // `now` is stamped by the fetch, not read here: both renders have to agree
  // about what "3분 전" means, and a component that reads the clock gives them
  // two different answers.
  const [found, stats] = await Promise.all([getPost(id), getGenesisStats()]);
  if (!found) notFound();
  const { post, now } = found;

  return (
    <SessionProvider>
      <LiveProvider initial={stats}>
        <div className="cm">
          <Bar locale={locale} />
          <div className="cm__wrap cm__wrap--narrow">
            <main>
              <Thread locale={locale} post={post} now={now} />
            </main>
            <CFooter locale={locale} />
          </div>
        </div>
      </LiveProvider>
    </SessionProvider>
  );
}
