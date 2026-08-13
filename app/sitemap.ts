import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { capturedAt } from "@/lib/economics";

/**
 * Every indexable route, with its locale pair.
 *
 * `/model` was missing here while being both crawlable and linked from the
 * footer — an omission rather than a decision, so it is listed now. `/alt*`
 * stays out: those are drafts, and `robots.ts` disallows them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(capturedAt);

  const pages: Array<{ ko: string; en: string; priority: number }> = [
    { ko: "/", en: "/en", priority: 1 },
    { ko: "/genesis", en: "/en/genesis", priority: 0.9 },
    { ko: "/model", en: "/en/model", priority: 0.7 },
    { ko: "/privacy", en: "/en/privacy", priority: 0.3 },
    { ko: "/terms", en: "/en/terms", priority: 0.3 },
  ];

  return pages.flatMap(({ ko, en, priority }) => {
    const languages = { ko: `${SITE}${ko}`, en: `${SITE}${en}` };
    return [
      {
        url: `${SITE}${ko}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority,
        alternates: { languages },
      },
      {
        url: `${SITE}${en}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: Math.round(priority * 0.9 * 100) / 100,
        alternates: { languages },
      },
    ];
  });
}
