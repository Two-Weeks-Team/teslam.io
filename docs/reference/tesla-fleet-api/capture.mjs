/**
 * Re-capture Tesla's Fleet API documentation.
 *
 *     node docs/reference/tesla-fleet-api/capture.mjs
 *
 * `developer.tesla.com` returns 403 to plain HTTP fetchers, so neither an agent
 * nor a CI job can read it on demand — which is the entire reason these pages
 * live in the repository. A real browser renders them fine, so this drives one.
 *
 * Overwrites the captured pages in place and stamps today's date. Keeping them
 * in git means the diff shows exactly what Tesla changed, which is worth more
 * than the pages themselves: this API moved twice in ways that silently
 * invalidated assumptions here, and both times nobody found out until somebody
 * re-read the docs.
 *
 * Needs a Chrome on the machine and nothing else. No key, no account.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "https://developer.tesla.com/docs/fleet-api";

/** Page path → filename. Add a row and it gets captured next run. */
const PAGES = {
  "": "docs-fleet-api",
  "/authentication/overview": "authentication-overview",
  "/authentication/third-party-tokens": "authentication-third-party-tokens",
  "/authentication/partner-tokens": "authentication-partner-tokens",
  "/endpoints/partner-endpoints": "endpoints-partner-endpoints",
  "/endpoints/vehicle-endpoints": "endpoints-vehicle-endpoints",
  "/fleet-telemetry": "fleet-api-fleet-telemetry",
  "/fleet-telemetry/available-data": "fleet-telemetry-available-data",
  "/billing-and-limits": "fleet-api-billing-and-limits",
  "/getting-started/best-practices": "getting-started-best-practices",
  "/virtual-keys/developer-guide": "virtual-keys-developer-guide",
  "/announcements": "fleet-api-announcements",
};

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
];

const PORT = 9333; // Not 9222 — leave the usual debugging port alone.
const profile = mkdtempSync(resolve(tmpdir(), "tesla-docs-"));

const chrome = spawn(
  CHROME[0],
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome takes a moment to open the port; poll rather than guess. */
async function endpoint() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return (await res.json()).Browser;
    } catch {
      /* not up yet */
    }
    await wait(500);
  }
  throw new Error("Chrome never opened its debugging port");
}

console.log("browser   ", await endpoint());

const tab = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id != null && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { resolve: res, reject: rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = (expr) =>
  send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
    .then((r) => r.result?.value);

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false,
});

const stamp = new Date().toISOString().slice(0, 10);
mkdirSync(HERE, { recursive: true });
let failed = 0;

for (const [path, name] of Object.entries(PAGES)) {
  const url = `${BASE}${path}`;
  await send("Page.navigate", { url });
  // The docs are a single-page app; there is no text until it renders.
  await wait(9000);

  const page = await evaluate(`(() => {
    const main = document.querySelector("main, article, [role=main]") || document.body;
    return { title: document.title, url: location.href,
             text: main.innerText.replace(/\\n{3,}/g, "\\n\\n").trim() };
  })()`);

  // A 404 renders perfectly happily and would otherwise be written out as if
  // it were documentation.
  if (!page || page.text.length < 400 || /doesn't exist|404/i.test(page.title)) {
    console.error(`  ✗ ${name.padEnd(36)} ${page?.title ?? "no response"}`);
    failed += 1;
    continue;
  }

  const title = page.text.split("\n")[0].trim();
  writeFileSync(
    resolve(HERE, `${name}.md`),
    `<!-- Captured verbatim from Tesla's documentation. Do not edit the body:\n` +
      `     if it is wrong, the fix is to re-capture, not to correct it here. -->\n\n` +
      `# ${title}\n\n` +
      `> **Source** <${page.url}>  \n` +
      `> **Captured** ${stamp} via headless Chrome — \`developer.tesla.com\` returns 403 to\n` +
      `> plain HTTP fetchers, so this is what a real browser rendered.\n\n` +
      `---\n\n${page.text}\n`,
  );
  console.log(`  ${String(page.text.length).padStart(6)} chars  ${name}`);
}

ws.close();
await fetch(`http://127.0.0.1:${PORT}/json/close/${tab.id}`).catch(() => {});
chrome.kill();

if (failed) {
  console.error(`\n✗ ${failed} page(s) did not capture — the reference is now part stale`);
  process.exit(1);
}
console.log(`\n✓ ${Object.keys(PAGES).length} pages captured ${stamp}`);
