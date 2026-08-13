import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat config straight from eslint-config-next. FlatCompat is deliberately not
 * used: it round-trips the config through JSON.stringify, which throws on the
 * plugin graph these presets ship under ESLint 10.
 */
const config = [
  {
    ignores: [
      ".next/**",
      ".wrangler/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      // Written by `wrangler types`. Editing it is pointless — it is
      // regenerated — and linting it only reports on Cloudflare's formatting.
      "cloudflare/worker-configuration.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
