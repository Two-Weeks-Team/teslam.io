import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // A stray lockfile in a parent directory makes Turbopack guess the wrong
  // workspace root. Pin it.
  turbopack: { root: import.meta.dirname },

  // The `.md` mirrors render from the same content modules as the HTML, so a
  // crawler, an LLM and a person cannot be shown different numbers.
  async rewrites() {
    return [
      { source: "/index.md", destination: "/api/md/ko" },
      { source: "/en/index.md", destination: "/api/md/en" },
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
