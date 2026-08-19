import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // A stray lockfile in a parent directory makes Turbopack guess the wrong
  // workspace root. Pin it.
  turbopack: { root: import.meta.dirname },

  // PostHog posts to `/e/` and `/flags/` — with the default redirect every
  // event pays for a 308 before it lands. Pinned by
  // tests/analytics-proxy.test.ts.
  skipTrailingSlashRedirect: true,

  // The `.md` mirrors render from the same content modules as the HTML, so a
  // crawler, an LLM and a person cannot be shown different numbers.
  async rewrites() {
    return [
      // The Markdown mirrors cover `/model`, not the front page — the board is
      // sample content, and the operating model is the document worth handing
      // to a crawler verbatim.
      { source: "/model.md", destination: "/api/md/ko" },
      { source: "/en/model.md", destination: "/api/md/en" },

      // Tesla polls this exact path to decide whether the application is still
      // registered, and its documentation says the key "must be and remain
      // hosted" there. A rewrite rather than a dot-prefixed directory in
      // `public/`, because the cost of a framework quietly ceasing to serve one
      // is vehicles declining to stream, reported as "not registered".
      {
        source: "/.well-known/appspecific/com.tesla.3p.public-key.pem",
        destination: "/api/tesla-public-key",
      },

      // Design directions under review. Each is a single self-contained file in
      // `public/`, deliberately outside the app so an experiment cannot reach
      // the shipped page's stylesheet — or be reached by it. `/alt` is the
      // index. These are temporary; they go away once a direction is chosen.
      { source: "/alt", destination: "/alt.html" },
      ...Array.from({ length: 10 }, (_, i) => ({
        source: `/alt${i + 1}`,
        destination: `/alt${i + 1}.html`,
      })),

      // PostHog, same-origin. Every posthog.com host is on every ad-block
      // list, and the proxy is what keeps an extension from deciding whether
      // this site may count its own visitors. The static rule must sit above
      // the catch-all — reversed, posthog-js loads from the ingestion host
      // and never boots, with nothing on screen to say so. Both pinned by
      // tests/analytics-proxy.test.ts.
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // This site never asks for location. The product does, inside the
            // Tesla Fleet API — never through the browser.
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
