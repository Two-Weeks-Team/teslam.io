import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * AI crawlers are named and allowed explicitly. This project wants the model
 * read and argued with, and the disclaimers are in the HTML and in the
 * structured data — a crawler that reads the page gets the affiliation and
 * the not-financial-advice notice with it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // `/alt*` holds design directions under review. They are public so they
      // can be looked at and argued over, but they are drafts — indexing them
      // would put half-finished pages under this brand's name in search.
      { userAgent: "*", allow: "/", disallow: ["/alt", "/alt$", "/alt*"] },
      {
        userAgent: [
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "ClaudeBot",
          "Claude-Web",
          "anthropic-ai",
          "PerplexityBot",
          "Google-Extended",
          "CCBot",
        ],
        allow: "/",
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
