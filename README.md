# dk-job-ops

A Claude-Code-native **Denmark job-search pipeline**. It scans job boards, evaluates each
posting against a transparent rubric, generates tailored **bilingual (English / Danish) CV
PDFs**, and tracks every application — all from inside Claude Code, with **zero fabrication**
as the hard quality bar.

The loop: **scan → evaluate → tailor → track.**

- **scan** — `scan.mjs` pulls postings from LinkedIn, ATS feeds, and (where available) the
  native Danish boards into `data/new/<date>.tsv`. Zero LLM tokens.
- **evaluate** — `/dk-job-ops evaluate` scores a posting (Denmark Ladder Score), saves the JD,
  and writes a Tier-2 report.
- **tailor** — `/dk-job-ops tailor` builds a per-job CV PDF (A4) in the language of the ad.
- **track** — every application lands in `data/applications.md` with a canonical status.

> It never auto-submits. Every CV and form answer is drafted for **you** to review and send.

---

## Prerequisites

- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** — the `onboard`, `review`,
  `evaluate`, `tailor`, `apply`, and `followup` modes all run inside it. The bare scanner runs
  without Claude Code, but that's a fraction of the value.
- **Node 20 LTS** (Node 18 also works; CI uses 20).

---

## Setup

```bash
# 1. install dependencies (no dev deps needed to run)
npm ci --omit=dev          # or: npm install

# 2. install the headless browser used for CV PDF generation
npx playwright install --with-deps chromium

# 3. (optional) add a free Jooble API key for one extra source
cp .env.example .env        # then put your key in JOOBLE_API_KEY=
```

The only secret is **`JOOBLE_API_KEY`** (free — sign up at
<https://jooble.org/api/about>). Missing key → Jooble is simply `skipped`; everything else
still runs.

---

## Running it

**Scan** (no LLM tokens, no Claude Code needed):

```bash
node scan.mjs               # writes data/new/<date>.tsv
```

…or run it on GitHub: **Actions → scan → Run workflow**. No cron is active — scanning is
manual / on-demand.

**Then, inside Claude Code:**

```
/dk-job-ops onboard         # FIRST — turns your ONBOARDING.md answers into profile + CVs + rubric
/dk-job-ops review          # walk the scan results → pick → evaluate → tailor → track
```

From there, `/dk-job-ops evaluate <url|text>`, `tailor <#>`, `apply <#>`, `track`, and
`followup` cover the rest. Run `/dk-job-ops` with no arguments for the menu.

---

## Day-one coverage (be realistic)

Out of the box, **these work**:

- **LinkedIn (Denmark)**
- **Five international ATS feeds** — Greenhouse, Lever, Ashby, SmartRecruiters, Workday —
  returning remote-EMEA / Denmark roles.

The **native Danish boards are VERIFY-AT-BUILD** and may not return results until you confirm
them from a Danish residential IP:

- **Jobnet** — public path is currently WAF + login-walled from datacenter IPs.
- **Jobindex** — fronted by Cloudflare.
- **TheHub** — needs Algolia credentials pasted into `portals.yml`.

So expect LinkedIn + ATS to deliver from the start, and treat Jobnet / Jobindex / TheHub as
best-effort until you've verified their endpoints/selectors locally. (See the conventions /
`portals.yml` for details.)

---

## Putting it on your own GitHub

Create a **new private repo** and push this code to it:

```bash
git init
git add -A
git commit -m "Initial dk-job-ops setup"
git remote add origin git@github.com:<your-username>/dk-job-ops.git
git branch -M main
git push -u origin main
```

Then:

- Edit **`{{GITHUB_USERNAME}}`** in `.github/workflows/notify.yml` to your GitHub username (this
  is who the daily-report issue gets assigned to — assignment is what triggers the GitHub
  Mobile push).
- (Optional) Add an **Actions secret** named **`JOOBLE_API_KEY`** if you want Jooble in the
  GitHub-run scans (Settings → Secrets and variables → Actions).

Keep the repo **private** — it holds your CV ground truth and application tracker.

---

## Next step

Fill in **[`ONBOARDING.md`](./ONBOARDING.md)**, then run **`/dk-job-ops onboard`**. That single
questionnaire seeds your profile, both CVs, the family base CVs, and the rubric snapshot —
with a ground-truth pass so nothing fabricated slips in.
