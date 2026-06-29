# Mode: evaluate — Tier-2 Full Evaluation

Full-JD evaluation of ONE posting the user picked (from the daily report, `data/pipeline.md`,
a pasted URL, or pasted JD text). Tier 1 (the cloud triage) scored it from title/snippet only;
this pass re-scores with the full JD and produces everything `tailor` and `apply` need.
**Output: ~1 page.** Load `profile.md` + `rubric.md` before anything else.

## Step 0 — Number, liveness, save the JD (in this order)

1. **Number.** Read `data/applications.md` (pull first — CLAUDE.md rule); `{###}` = highest
   existing `#` + 1, 3-digit zero-padded. This number names the JD file, the report, and the
   tracker row.
2. **Liveness.** Fetch the URL (WebFetch, or `curl -sL` fallback). If HTTP 404/410, or the page
   says the ad is closed — `udløbet`, `stillingen er besat`, `ikke længere aktiv`,
   **`ansøgningsfristen er overskredet`** (Danish boards may return HTTP 200 with a closed
   banner when an employer pulls an ad early), "no longer accepting applications" — mark it
   Closed: tracker row status `Discarded` (the canonical state covering "offer closed", see
   `templates/states.yml`), note `closed before eval`, tell the user, and **STOP**. No report, no score.
3. **Save the JD FIRST — always.** Write the full JD text (title, company, complete body,
   posted/closes dates, comp if stated) to `jds/{###}-{company-slug}.md` with a 2-line header
   (source URL + saved date). **Jobnet/Jobindex/TheHub ads get pulled or expire once the
   application deadline passes — the saved copy is the only durable record.** Do this BEFORE
   any analysis. If the user pasted text instead of a URL, save the paste verbatim.

## Step 1 — Re-score: A / P / U on the full JD

Score strictly per `rubric.md`: gates first (X1–X5), then A/P/U anchors + modifiers, A-gate
(A ≤ 2 → SKIP), weighted total to one decimal, band. Assign `family` (F1–F7) and `lang`
(`en`|`da` — language of the ad) and extract `closes` if stated. If Tier 1 scored this posting,
give one line on any delta and why (the full JD usually reveals seniority, third languages, or
a hidden ladder).

## Step 2 — Tailoring Brief (drives `tailor`)

| JD must-have | His asset (via profile.md bridge map) | CV evidence (cv-en.md / cv-da.md line) |
|---|---|---|

Then **Gaps & bridges**: each real gap → the honest bridge phrase, or "name as a gap to learn"
(GROUND-TRUTH RULE — relabel real assets, never add absent ones).

## Step 3 — Employer snapshot (max 2 web searches)

Budget: **two searches, total.** Suggested: `"{company}" reviews OR anmeldelser` and
`"{company}" layoffs OR fyringer 2026`. Looking for: is the employer real and hiring (not a ghost
ad / staffing front), worker-review red flags, recent layoffs in this function. For obviously
known employers (Big4, major banks, recognized product companies) skip the searches — one line
of context instead. Present observations, not accusations.

## Step 4 — Comp + logistics

- **Comp:** as stated in the ad — Danish quotes are **gross monthly** (gross/måned) unless
  stated otherwise — set against the `rubric.md` market table. **Informational only, never a gate.**
- **Application channel:** Jobindex "Søg dette job" / Jobnet / TheHub / LinkedIn Easy Apply /
  ATS form (which one) / email.
- **Cover letter (ansøgning) required?** Only write one if the ad asks (see profile.md).
- **Closes date:** drives the follow-up cadence (`modes/followup.md`).

## Step 5 — STAR seeds (3–5)

Three to five one-line STAR seeds mapped to the JD's main asks, drawn from the profile.md
proof points (the candidate's strongest projects, employment outcomes, and self-directed
learning arcs). Seeds, not full stories — expand at interview time.

## Step 6 — Machine Summary, save, track

End every report with this YAML block (downstream modes parse it):

```yaml
## Machine Summary
company:
role:
url:
source:        # jobnet | jobindex | thehub | linkedin | jooble | ats | manual
family:        # F1–F7
lang:          # en | da
closes:        # YYYY-MM-DD or null
score: { a: 0, p: 0, u: 0, total: 0.0 }
band:          # PRIORITY | APPLY | BACKLOG | SKIP
cv: null       # output/ PDF path once tailored
status: Evaluated
```

1. Save the report to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` (create the dir if
   missing). Header lines: Company — Role, Date, URL, Band + score, JD file path.
2. Append the tracker row to `data/applications.md` (format + rules in `modes/track.md`):
   status `Evaluated`, PDF ❌, Report link. **Never create a second row for an existing
   company+role — update it.** Pull before write.
3. If band is PRIORITY or APPLY, offer the next step: `tailor {###}`.
