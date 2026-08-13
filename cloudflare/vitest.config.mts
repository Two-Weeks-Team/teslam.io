import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Worker tests run in workerd against a real D1, not against a mock.
 *
 * A hand-written fake would have to reimplement the two things these tests
 * exist to check — that a UNIQUE constraint decides a contested seat, and that
 * a recursive CTE finds the lowest free number. A fake that got those right
 * would be a SQLite; a fake that got them wrong would pass.
 *
 * Kept in its own config because the site's suite runs in Node and cannot load
 * workerd. `pnpm test` runs both.
 *
 * Vitest 4 removed `test.poolOptions`; the pool is now a plugin, which is what
 * the package's own v3→v4 codemod rewrites configs into.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      // The pool needs the entry module to find the Durable Object class.
      main: "cloudflare/worker.ts",
      miniflare: {
        compatibilityDate: "2026-08-11",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: { DB: "genesis-test" },
        durableObjects: { LIVE: "LiveBoard" },
        bindings: {
          ALLOWED_ORIGINS: "https://teslam.io",
          SITE_ORIGIN: "https://teslam.io",
          EXPORT_TOKEN: "test-export-token",
        },
      },
    }),
  ],
  test: { include: ["cloudflare/**/*.test.ts"] },
});
