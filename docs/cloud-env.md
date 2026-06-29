# Cloud environment setup (Claude Code cloud sessions)

How to run this repo in a Claude Code cloud session. Day-to-day it behaves like the
local terminal — open the repo in a cloud session and chat the same way.

## Environment setup script (paste into the env's setup field)

```bash
npm ci --omit=dev
# Chromium for generate-pdf.mjs (CV PDF rendering). Guarded so a slow download
# can't blow the env build budget.
npx playwright install --with-deps chromium || true
```

## Network allowlist

Cloud envs default to restricted egress (package registries + GitHub only). The job
boards / ATS hosts below are BLOCKED until you add them to the env's allowlist. Until
then, run scans on GitHub Actions (`scan` workflow — unrestricted egress) or locally,
and let cloud sessions consume the committed TSVs (needs no extra network).

Hosts to allow (scan + Tier-2 liveness):

```
jobindex.dk                 job.jobnet.dk            thehub.io
www.linkedin.com            dk.linkedin.com          *.linkedin.com
jooble.org
boards.greenhouse.io        boards.eu.greenhouse.io  job-boards.greenhouse.io
api.lever.co                jobs.lever.co            jobs.eu.lever.co
api.ashbyhq.com             jobs.ashbyhq.com
api.smartrecruiters.com     jobs.smartrecruiters.com
*.myworkdayjobs.com
```

## Cloud vs local

- **Local is primary for liveness + tailoring.** A cloud session behind the egress
  allowlist can't reliably live-fetch the job boards, so liveness checks, JD
  fetching, and Tier-2 evaluation belong on the local machine (full network).
- **Cloud / Actions are good for** manual scans and dashboard rebuilds — both run
  without live board fetches once the allowlist (or Actions' unrestricted egress)
  covers the providers.
- Cloud sessions push to a **feature branch** (never straight to main) — review and
  merge after; tracker/report updates land through that branch.
- Generated files leave the sandbox only via git → `output/` is committed (PDFs,
  letters, dashboard).
- No machine-local memory in the cloud: durable state lives in the repo —
  `CLAUDE.md` (policies) and `docs/ops-notes.md` (operational state).

## Dashboard

`output/dashboard.html` is rebuilt by the `dashboard` workflow on every push that
touches `data/` or `reports/` — download or open it from GitHub on any device. To
rebuild locally: `node dashboard.mjs`.
