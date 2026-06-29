# dk-job-ops — Denmark Job-Search Pipeline

One candidate (the repo owner — fill in via `/dk-job-ops onboard`), any
professional Denmark role with a real skill/experience/education match: cloud/DevOps, data,
IT support/BPO, banking, audit/Big4, corporate ops, client-facing (families F1–F7 in
`rubric.md`). A cloud routine scans the boards overnight and commits a triaged morning report;
locally this repo evaluates picks, generates tailored bilingual CVs, and tracks applications.

**Volume framing:** high volume IS the strategy — the Danish junior market rewards many
well-aimed applications. The quality bar is **zero fabrication and per-ad language fit**, not
fewer applications.

## File map

| Path | What |
|------|------|
| `README.md` | Handoff/setup guide — start here on a fresh clone. |
| `ONBOARDING.md` | Questionnaire the owner fills before running `/dk-job-ops onboard`. |
| `cv-en.md` / `cv-da.md` | Ground-truth CVs (EN / Danish). Everything tailored derives from these. |
| `profile.md` | Who he is: identity, narrative, proof points, tailoring policy, GROUND-TRUTH RULE, anti-claims, bridge map, language + cover-letter rules. |
| `rubric.md` | Denmark Ladder Score: gates, A/P/U anchors, bands, families F1–F7, salary table. |
| `scan.mjs` + `portals.yml` + `providers/` | Zero-token scanner (boards + ATS APIs). |
| `modes/` | Claude instruction files: onboard, review, evaluate, tailor, apply, track, followup. |
| `.claude/skills/dk-job-ops/SKILL.md` | `/dk-job-ops` router. |
| `templates/` | `cv-template.html` ({{PLACEHOLDER}}s), `bases/f{N}-{lang}.md` family base CVs, `states.yml` canonical statuses, `daily-report.md` skeleton. |
| `generate-pdf.mjs` | HTML → PDF: `node generate-pdf.mjs in.html out.pdf --format=a4 --fit`. |
| `jd-extract.mjs` | Strip fetched HTML/ATS-JSON to plain JD text — agents never read raw dumps. |
| `dashboard.mjs` | Tracker + reports → `output/dashboard.html` (static; auto-rebuilt by the `dashboard` Action). |
| `docs/ops-notes.md` | Durable operational state — **read this first in cloud sessions** (no machine memory there). |
| `docs/cloud-env.md` | Cloud env setup script, network allowlist, cloud-vs-VM workflow differences. |
| `data/applications.md` | The tracker (format below). |
| `data/pipeline.md` | Manual URL inbox. |
| `data/daily/{date}.md` | Morning triage report (cloud-committed). |
| `data/new/{date}.tsv` | Raw scanner output → triage handoff. |
| `data/scan-history.tsv` | Append-only dedup ledger. |
| `data/follow-ups.md` | Follow-up history. |
| `jds/{###}-{company}.md` | Saved JD text. `reports/{###}-{company}-{date}.md` = Tier-2 reports. `output/` = PDFs (gitignored). |

## Hard rules

1. **Load `profile.md` + `rubric.md` before ANY evaluation or tailoring.** They are the
   scoring and representation contract — never score or write candidate-facing text from
   memory.
2. **GROUND-TRUTH RULE** (full text in `profile.md`): a skill/tool/cert/experience may appear
   in a CV, cover letter, or form answer ONLY if it is literally in `cv-en.md`/`cv-da.md`. JD
   vocabulary may relabel what's there, never add what isn't. The anti-claims list in
   profile.md is binding.
3. **Mirror rule:** any `cv-en.md` edit must be mirrored in `cv-da.md` in the same session
   (and vice versa).
4. **Language of the ad** picks the CV/answer language (`en`|`da`); æ/ø/å render fine.
   Ambiguity rule in profile.md. Language is metadata, never a gate.
5. **Save the JD first:** evaluation ALWAYS writes the full JD text to
   `jds/{###}-{company-slug}.md` before any analysis — Danish board ads (Jobindex/Jobnet) expire.
6. **Tracker:** `| # | Date | Company | Role | Lang | Closes | Score | Status | PDF | Report | Notes |`
   in `data/applications.md`. Statuses are exactly the canonical set in `templates/states.yml`
   (Evaluated/Applied/Responded/Interview/Offer/Rejected/Discarded/SKIP). One row per
   company+role — update, never duplicate.
7. **Pull before write:** the cloud agent commits `data/` daily — `git pull` before reading or
   editing tracker/data files.
8. **NEVER auto-submit an application.** Draft everything, fill anything, then STOP before any
   Submit/Ansøg ("Søg dette job") click — the human reviews and sends. Only record `Applied`
   after the user confirms they sent it.

## Daily loop

Overnight, a Claude cloud routine runs `scan.mjs`, triages every new row against `rubric.md`
(Tier 1 — TSV fields only), and commits `data/daily/{date}.md` + `data/new/` +
`data/scan-history.tsv` (commit `scan {date}: +N new (S priority)`). Consume it via
**`/dk-job-ops review`** (or `review blitz` to parallel-process all PRIORITY items). The routine
never applies to jobs and never edits rubric/portals/scan.mjs.

## Modes

| Command | File | Does |
|---------|------|------|
| `/dk-job-ops onboard` | `modes/onboard.md` | Fill `profile.md`, `cv-en.md`/`cv-da.md`, family bases, rubric snapshot from `ONBOARDING.md` — ground-truth pass. |
| `/dk-job-ops review` | `modes/review.md` | Walk today's report → queue picks → evaluate→tailor→track. `blitz` = all PRIORITY in parallel. |
| `/dk-job-ops evaluate X` | `modes/evaluate.md` | Tier-2: liveness, save JD, re-score A/P/U, Tailoring Brief, report + tracker row. |
| `/dk-job-ops tailor #` | `modes/tailor.md` | Family base → patched CV → ground-truth pass → A4 PDF (æ/ø/å check). |
| `/dk-job-ops apply #` | `modes/apply.md` | Draft form answers + portal notes. Never submits. |
| `/dk-job-ops track` | `modes/track.md` | Tracker stats + status edits. |
| `/dk-job-ops followup` | `modes/followup.md` | Close-date-aware cadence + drafts in the ad's language. |

Paste a URL/JD with no sub-command → fast path: evaluate → tailor → track.

## Agent model tiering (token budget)

Subagents/workflow stages must ALWAYS get an explicit `model` — never let them silently
inherit the session model:

- `haiku` — mechanical: liveness/fetch (via `jd-extract.mjs`), file shuffling, render-only.
- `opus` — ALL batch drafting + scoring: Tier-2 re-scores, reports, CV tailoring, cover
  letters, batch form answers.
- Session model (orchestrator only): queue building, single-writer edits to shared files,
  and a **final QA gate** on candidate-facing artifacts — read the finished CV/letter
  against `cv-en.md`/`cv-da.md` + the anti-claims list before the user sends (a few k tokens, cheap).

## Stack

Node 20 ESM (`.mjs`), cheerio + js-yaml + dotenv + playwright (PDF only). Output in `output/`
(gitignored). Report/JD numbering: 3-digit zero-padded, max existing tracker `#` + 1.
