# Lessons

Failures worth not repeating. Appended by `/keel:lesson`, read at the start of
any session that resumes prior work.

Each entry is four elements and no more. The heading states the **rule you now
follow**, not the incident — the next reader skims headings and stops there.

```markdown
### L<N> — <the rule, one line>

- **Problem**: what was observed, 1–2 sentences.
- **Cause**: the root cause, one sentence. Not the symptom.
- **Fix**: what is done differently now, naming the file or command that enforces it.
- **Reference**: commit, PR, run, or path where this is visible.
```

A lesson that can be checked mechanically should ship with the check — a
regression test, a gate step, or a hook — and the **Fix** line should name it.
A lesson with an enforcing test is a guarantee. A lesson without one is a hope.

---

<!-- Newest first. -->

## Entries

### L4 — Measure a service from outside, not from the host it runs on

- **Problem**: `kbeauty.market` was reported as returning 502 in a handoff, in
  `deploy/fleet-telemetry/README.md`, and again in this session. It returns 200.
  A live site was recorded as broken, twice, in two documents.
- **Cause**: the check was run over SSH *on 193*, where `/etc/hosts` pins
  `kbeauty.market` to `127.0.0.1`. The request looped back to the local nginx,
  whose leftover vhost proxies to a dead port. From outside, the domain resolves
  to Vercel.
- **Fix**: probe public hostnames from a machine that is not the origin, and
  read `server:` off the response to confirm which origin answered. The
  corrected survey is in `deploy/fleet-telemetry/README.md` under "Live".
- **Reference**: `deploy/fleet-telemetry/README.md`, 2026-08-17.

### L3 — A reading that contradicts the record is a fault report, not a measurement

- **Problem**: a corrupt frame claiming 1320 miles on a car that had done 1010
  was correctly refused as `implausible-speed` and stored anyway. It became the
  baseline, so every later genuine reading was lower and refused as
  `not-increasing` — permanently, silently, with the car still streaming and
  every health check green.
- **Cause**: "refusing to accrue is not refusing to record" was applied to all
  four rejection reasons, including the two that say the reading itself is wrong.
- **Fix**: `cloudflare/lib/ingest.ts` splits refusals about the *interval*
  (`below-resolution`, `gap-too-long` — reading kept, it is the next baseline)
  from refusals about the *reading* (`not-increasing`, `implausible-speed` —
  dropped). Enforced by "does not let a corrupt frame become the baseline" and
  "drops a reading that went backwards" in `cloudflare/telemetry.test.ts`.
- **Reference**: commit `0cc8a31`, PR #18.

### L2 — Prove a data path with a record that writes nothing

- **Problem**: verifying the production pipe end to end meant either trusting
  the tests or putting fabricated readings into a database that holds real
  registrations.
- **Cause**: the only obvious end-to-end fixture is a valid record, and a valid
  record is a write.
- **Fix**: publish a record whose VIN nothing has linked. It traverses Redis, the
  consumer, HTTPS and the Worker, exercises the D1 lookup, and is refused as
  `unknown-vehicle` — full coverage, zero rows. Written down in
  `deploy/fleet-telemetry/README.md` under "What this does not do yet".
- **Reference**: 2026-08-17 production verification, Worker version `76115e4e`.

### L1 — Migrate before deploying when new code sweeps a new table

- **Problem**: the production Worker's nightly cron gained `purgeLocations`,
  which deletes from `reading_locations`. That table did not exist in production.
- **Cause**: the ledger migrations had never been applied to production — the
  previous handoff said they had, and they had not.
- **Fix**: apply migrations, verify the tables and the untouched rows, then
  deploy. `wrangler d1 migrations list <db> --remote` before any deploy that
  touches the schema, and `d1 time-travel info` first so the bookmark is on
  record.
- **Reference**: 2026-08-17, bookmark `000000f6-00000000-000050ca-e4feef958d677593cec50c3807a693fc`.
