/**
 * PostHog boots here, per the Next.js instrumentation-client convention and to
 * match the sibling repos (kbeauty.market, agentba.se). Without a key it does
 * nothing at all, so a local checkout builds and runs clean and never writes
 * into the production project.
 *
 * This file rather than a layout component: there is no `app/layout.tsx` —
 * each locale owns its root under `app/(ko)` and `app/(en)`, and mounting a
 * component in both would be two chances to forget one.
 *
 * The import is dynamic. posthog-js is ~240 kB, and a page that defers its own
 * hero to keep the `<h1>` first should not hand a quarter of a megabyte to the
 * thing merely watching it.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      // Same-origin path, proxied in next.config.ts, so an ad blocker does not
      // decide whether the site can count its own visitors. `ui_host` still
      // names the real host — the toolbar builds its links from it.
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2025-05-24",

      // Nothing here ever calls `identify` — there is no sign-in. Profiles
      // for anonymous visitors bill at the identified rate and buy nothing;
      // distinct_id still gives unique visitors and funnels.
      person_profiles: "identified_only",
    });
  });
}
