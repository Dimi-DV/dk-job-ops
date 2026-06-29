# Mode: apply — Application Assistant

Helps fill the application form the user has open: reads the saved report + `profile.md`,
drafts every answer; the **user** pastes and clicks send.

**NEVER auto-submit — no exceptions.** Draft answers, fill fields if driving a browser, attach
nothing, and STOP before any Submit/Send/Søg/Ansøg button. The human reviews and
clicks.

## Workflow

1. **IDENTIFY** — company + role from the URL, a screenshot (Read tool reads images), or
   pasted form questions.
2. **LOAD** — find the evaluation in `reports/` (case-insensitive grep on company); read the
   full report + `profile.md`. No report → offer to run `modes/evaluate.md` first (it's fast
   and produces the Tailoring Brief the answers draw on).
3. **COMPARE** — if the role on screen differs from the evaluated one, notify; adapt the
   answers or re-evaluate per the user's call; fix the tracker row title if it changed.
4. **ANALYZE** — list ALL visible form questions: free text, dropdowns, yes/no, salary
   fields, uploads. If the form scrolls, iterate screenshot-by-screenshot until covered.
5. **GENERATE** — one answer per question, **in the ad's language** (Danish ads get Danish
   answers), drawing on the report's Tailoring Brief + STAR seeds and profile.md proof points.
   The GROUND-TRUTH RULE applies to form answers exactly as to CVs — no invented experience,
   tools, or years.
6. **PRESENT** — formatted copy-paste blocks: `### {exact question}` → blockquoted answer,
   then a Notes section (observations, fields to double-check).

**Standard answers (from profile.md):**
- Work authorization: [WORK AUTHORIZATION — from profile.md; e.g. "EU/EEA citizen — no work
  permit required" / "Holds Danish residence & work permit" / "Requires sponsorship". State
  only what the field asks; never misstate it.]
- Availability / start date: [AVAILABILITY — from profile.md; e.g. "immediately" / notice
  period / earliest start date].
- Salary expectation, if the field is mandatory: the rubric.md market band for the segment,
  framed as a **DKK gross monthly** range; never volunteer a number when the field is optional.
- Phone: [+CC phone — from profile.md].
- CV upload: the tailored PDF from `output/` for THIS posting — never a generic CV.

## Portal notes

**Jobindex (jobindex.dk)** — Denmark's largest board. Many listings hand off to the employer's
own ATS or an email application; some use Jobindex's in-platform apply ("Søg dette job"). **Upload
the fresh per-job PDF for every application** — replace/attach the tailored `output/cv-…pdf`,
don't let a stale stored CV go out. Where the ad routes to email or an ATS, follow that target's
rules below. The cover letter (ansøgning), when asked, goes in the motivation field or as a
second attachment. Selection often starts **after the deadline (ansøgningsfrist)** passes, so a
better-tailored CV tomorrow beats a generic one today.

**Jobnet (jobnet.dk)** — the public employment-service board; some roles apply through Jobnet's
own system (MitID login), many redirect to the employer's site. Same fresh-PDF rule. Public-
sector and municipal ads usually demand a formal ansøgning — surface that requirement, never
auto-write it.

**TheHub (thehub.io)** — Nordic startup/scaleup board; apply usually links out to the company's
own form or an email address (occasionally an in-platform apply). IT/product-heavy and often in
English — let the ad's language pick the CV. Same fresh-PDF rule.

**LinkedIn Easy Apply** — pre-fills from the LinkedIn profile; ALWAYS swap the default CV for
the tailored PDF; answer screener questions from the report; review every pre-filled field
before the user submits.

**ATS forms:**
- **Greenhouse** — one long form; cover letter is an optional field; nothing saves until
  submit, so draft all answers before the user starts pasting.
- **Lever** — minimal form (name/email/CV + a few custom questions); the "Additional
  information" box is the place for a 2–3 sentence tailored pitch.
- **SmartRecruiters** — multi-step wizard; often parses the CV into a profile — verify the
  parsed fields against the real CV before continuing.
- **Workday** — separate account per company; its CV parser mangles dates/titles — re-check
  every parsed field. **Illegal-character validation:** Workday text fields reject
  `< > [ ] " { } \` — so when the ground-truth CV bullets contain straight double quotes, the
  auto-parsed description boxes fail with "Contains illegal characters". Fix: hand the user a
  cleaned paste block — drop/replace double quotes (single quotes are legal), rejoin PDF
  line-wrap hyphens, delete any section-label fragments the parser glued onto the text.

## Post-send (only after the user CONFIRMS it was actually sent)

1. Pull, then update the tracker row in `data/applications.md`: status `Applied` (canonical,
   see `templates/states.yml`); note the send date in Notes if it differs from the row date.
2. Update the report's Machine Summary `status: Applied`.
3. **Commit + push the tracker/report updates** as soon as the send is confirmed — don't batch
   post-send updates; push each one so the status is recorded.
4. State the follow-up date this triggers (cadence in `modes/followup.md` — ATS +7d,
   Jobindex/Jobnet close+3–5d, banks +14d).

Never record an application the user hasn't confirmed sending.
