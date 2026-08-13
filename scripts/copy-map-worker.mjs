#!/usr/bin/env node
/**
 * Publish MapLibre's web worker as a static asset.
 *
 * MapLibre runs tile parsing in a module worker that it constructs from a URL
 * relative to its own bundle. Turbopack does not emit that URL, so the request
 * 404s, the dev server answers with an HTML error page, and the browser refuses
 * it for having a non-JavaScript MIME type. The map then builds its canvas and
 * its controls and quietly never loads a single tile — which is exactly what it
 * did here, with no error event and nothing in the console but the MIME
 * complaint.
 *
 * Copying the worker into `public/` and pointing `setWorkerUrl` at it sidesteps
 * the bundler entirely. Copied at build time rather than committed so it cannot
 * drift from the installed version: a vendored worker from a different release
 * than the main bundle is a bug that would only appear under load.
 *
 * The worker imports the shared chunk relatively, so both files go to the same
 * directory.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = join(process.cwd(), "public", "maplibre");

mkdirSync(out, { recursive: true });

for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
  process.stdout.write(`maplibre: published ${file}\n`);
}
