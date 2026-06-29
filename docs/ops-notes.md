# Ops notes — durable operational state

Repo-resident replacement for machine-local session memory (a fresh Claude Code
session reads this first). Update it when operational state changes.

**Execution home: LOCAL is primary.** A cloud session behind the egress allowlist
can't reliably live-fetch job boards (see `docs/cloud-env.md`), which guts liveness
checks / JD fetching / Tier-2 — run those locally. What works fine in the cloud or on
GitHub Actions: scans, dashboard rebuilds, and artifact distribution via the committed
`output/`.

## Automation state

- **No cron is active** — scanning is manual by design.
- **Scans are manual**: GitHub Actions → `scan` workflow → Run workflow (free, zero
  LLM tokens), or `node scan.mjs` locally. Then triage in-session via
  `/dk-job-ops review`.
- The `dashboard` workflow rebuilds `output/dashboard.html` on data/report pushes.
- **Danish boards are VERIFY-AT-BUILD**: Jobnet / Jobindex / TheHub endpoints and
  selectors are best-effort and may need confirming from a Danish residential IP
  (datacenter IPs hit WAF / Cloudflare / login walls). LinkedIn (Denmark) + the
  international ATS feeds (Greenhouse / Lever / Ashby / SmartRecruiters / Workday)
  work out of the box. Don't assume the native Danish boards return rows until
  verified.

## Standing policies (full text where noted)

- **Agent model tiering** — CLAUDE.md: haiku = mechanical, opus = batch
  drafting/scoring, session model = orchestration + final QA gate only.
- **Lazy tailoring** — modes/review.md: batch runs evaluate only; CV PDFs are
  generated per pick (in tailor mode), not for every row.
- **X6 pure-call-center gate** — rubric.md: pure customer-care / dispatch / BPO
  headset seats are out; technical-ladder support stays.
- **PDF render**: always `--fit` (generate-pdf.mjs auto-scales to one A4 page) —
  never hand-iterate page fitting.
- **Tier-1 ↔ Tier-2 divergence.** Tier-1 (title + snippet only) regularly swings
  ±2 bands vs Tier-2 (full JD). Two guards: (1) **snippet enrichment** — providers
  fetch a per-card seniority badge + JD excerpt wherever the board exposes it (e.g.
  the LinkedIn guest fragment, the Ashby board JSON, Greenhouse `?content=true`);
  boards that only expose the body via a per-job fetch stay snippet-thin. (2)
  **Tier-1 recall-first rule** in rubric.md — Tier-1 only hard-gates on UNAMBIGUOUS
  walls; bare professional titles go BACKLOG → Tier-2, never assume-SKIP. Re-audit a
  sample of Tier-1 SKIPs against full JDs periodically to confirm the false-negative
  rate stays low.

## Pending setup

1. `JOOBLE_API_KEY` is optional — add it as a GitHub Actions secret (and to a local
   `.env`) for Jooble coverage (free key: jooble.org/api/about). Missing key →
   Jooble is simply `skipped`; everything else runs.
2. Confirm the native Danish board endpoints (Jobnet / Jobindex / TheHub) from a
   Danish residential IP before relying on them (see VERIFY-AT-BUILD above).
