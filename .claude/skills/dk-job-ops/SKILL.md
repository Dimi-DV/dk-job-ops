---
name: dk-job-ops
description: Denmark/Copenhagen job-search command center — review the daily scan report, run Tier-2 evaluations of postings, generate tailored bilingual (EN/DA) CV PDFs, draft application answers, track applications, and manage follow-ups. Trigger on any job-search intent — a job ad URL or pasted JD (Jobnet, Jobindex, TheHub, LinkedIn, ATS links), "job"/"stilling"/"jobopslag"/"ansøg"/"søg dette job"/"jobannonce", CV tailoring requests, application status questions, or the morning review of data/daily/.
user-invocable: true
argument-hint: "[onboard | review | review blitz | evaluate {url|text} | tailor {#} | apply {#} | track | followup]"
---

# dk-job-ops — Router

Hard rules live in `CLAUDE.md` (auto-loaded): load `profile.md` + `rubric.md` before any
evaluation or tailoring; GROUND-TRUTH RULE; never auto-submit; pull before writing `data/`.

## Mode routing

Determine the mode from the arguments:

| Input | Action |
|-------|--------|
| (empty / no args) | Show the menu below |
| URL or JD text (not a known sub-command) | **Fast path:** `modes/evaluate.md` → offer `modes/tailor.md` → tracker row |
| `onboard` | `modes/onboard.md` — fill profile/CVs/bases/rubric from `ONBOARDING.md` |
| `review` | `modes/review.md` |
| `review blitz` | `modes/review.md` — blitz variant (parallel subagents over ALL PRIORITY items) |
| `evaluate {url\|text\|#}` | `modes/evaluate.md` on that posting |
| `tailor {#}` | `modes/tailor.md` for report/tracker number # |
| `apply {#\|url}` | `modes/apply.md` |
| `track` | `modes/track.md` |
| `followup` | `modes/followup.md` |

**Fast-path detection:** treat the input as a posting if it contains a URL (`http…` — Jobnet,
Jobindex, TheHub, LinkedIn, Greenhouse/Lever/Ashby/SmartRecruiters/Workday, company sites) or
reads like JD text — EN keywords: "responsibilities", "requirements", "qualifications", "we're
looking for"; DA keywords: "om jobbet", "dine opgaver", "kvalifikationer", "vi søger",
"arbejdsopgaver", "ansøg", "søg dette job", "jobannonce". Not a sub-command and not a posting →
show the menu.

**Context loading:** after picking the mode, read `modes/{mode}.md` and execute it. Every mode
that scores or generates candidate-facing text loads `profile.md` + `rubric.md` first.

## Menu (empty input)

```
dk-job-ops — Denmark job search

  /dk-job-ops onboard      → set up profile.md + CVs + rubric from ONBOARDING.md (run this first)
  /dk-job-ops {URL or JD}  → fast path: evaluate → tailor → track (paste text or link)
  /dk-job-ops review       → walk today's scan report (data/daily/) — the morning loop
  /dk-job-ops review blitz → batch-process ALL PRIORITY items in parallel (eval + PDF + row)
  /dk-job-ops evaluate X   → Tier-2 evaluation of one posting (saves JD + report)
  /dk-job-ops tailor 014   → per-job CV PDF (EN/DA) from report #014
  /dk-job-ops apply 014    → draft application answers — never auto-submits
  /dk-job-ops track        → tracker overview + stats (data/applications.md)
  /dk-job-ops followup     → follow-up cadence + drafts (close-date aware)

Inbox: drop URLs into data/pipeline.md — review picks them up.
Fresh jobs arrive overnight in data/daily/{date}.md (cloud routine) → start with review.
```
