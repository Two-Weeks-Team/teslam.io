#!/usr/bin/env node
/**
 * One-time consent, to mint the refresh token the Worker sends mail with.
 *
 * Google will not hand a long-lived credential to a script — a human has to
 * approve it in a browser, signed in as the account that owns the alias. This
 * runs a loopback server for exactly one redirect, exchanges the code, prints
 * the refresh token, and exits. Nothing is written to disk: the token goes
 * straight into `wrangler secret put`, which is the only place it should live.
 *
 *   node scripts/gmail-refresh-token.mjs <client_id> <client_secret>
 *
 * Before running, in the Google Cloud project that owns the OAuth client:
 *   - enable the Gmail API
 *   - add http://127.0.0.1:8787/callback as an authorised redirect URI
 *   - add your Workspace address as a test user, if the app is unpublished
 */

import { createServer } from "node:http";

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("usage: node scripts/gmail-refresh-token.mjs <client_id> <client_secret>");
  process.exit(1);
}

const REDIRECT = "http://127.0.0.1:8787/callback";

// `gmail.send` only. The Worker never reads a mailbox, so it should not be
// able to — a broader scope here would be a standing permission nobody needs.
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Without this, Google returns a refresh token only on the very first
    // consent and silently omits it on every later one.
    prompt: "consent",
  });

console.log("\nOpen this, signed in as the address you will send from:\n");
console.log(authUrl + "\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("no code");
    server.close();
    process.exit(1);
  }

  const token = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  }).then((r) => r.json());

  if (!token.refresh_token) {
    res.writeHead(500).end("no refresh token — revoke the app's access and retry");
    console.error("\nNo refresh token returned:", token);
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(
    "Done. Return to the terminal — you can close this tab.",
  );

  console.log("\nRefresh token:\n");
  console.log(token.refresh_token + "\n");
  console.log("Store it, and the client pair, as Worker secrets:\n");
  console.log("  npx wrangler secret put GMAIL_CLIENT_ID     --config cloudflare/wrangler.jsonc --env=''");
  console.log("  npx wrangler secret put GMAIL_CLIENT_SECRET --config cloudflare/wrangler.jsonc --env=''");
  console.log("  npx wrangler secret put GMAIL_REFRESH_TOKEN --config cloudflare/wrangler.jsonc --env=''");
  console.log("  npx wrangler secret put MAIL_FROM           --config cloudflare/wrangler.jsonc --env=''  # noreply@teslam.io\n");

  server.close();
  process.exit(0);
});

server.listen(8787, "127.0.0.1", () => {
  console.log("Waiting for the redirect on " + REDIRECT + " …");
});
