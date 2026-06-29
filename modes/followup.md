# Mode: followup — Cadence + Drafts

Tracks follow-up timing for active applications and drafts the messages. No script — read
`data/applications.md` and `data/follow-ups.md` directly (pull first).

## Cadence rules (Denmark-specific — close-date-aware)

| Channel / employer | First follow-up due | Why |
|---|---|---|
| ATS application (Greenhouse / Lever / SmartRecruiters / Workday / company site) | **applied + 7 days** | These employers review rolling; an early nudge is normal. |
| Jobindex / Jobnet / TheHub ad | **close date + 3–5 days** | Selection typically starts only AFTER the application deadline (ansøgningsfrist) passes. Following up before the deadline is noise — wait it out. |
| Banks / corporates / structured intakes (Danske Bank, Nordea, Jyske, Big4 cohorts…) | **applied + 14 days** | HR cycles are slow and intake programs run on their own timelines. |
| Status `Responded` | +1 day (urgent — reply today) | |
| Status `Interview` | +1 day thank-you, then +3 days | |

Subsequent follow-ups: +7 days. **Max 2 unanswered follow-ups** → mark cold; suggest
`Discarded` or deprioritize. Channel classification comes from the report's Machine Summary
`source:` field — **the source field wins when rows match multiple rules**: a bank/corporate
ad applied via Jobindex/Jobnet follows the close-date rule; the 14-day rule applies only to
F4/F5 applications sent through a direct channel (company portal / email).

Note: `Evaluated` rows are out of scope here by design — the apply-before-close reminder for
evaluated-but-not-applied jobs lives in `modes/track.md`.

## Workflow

1. **Pull**, read the tracker; for every active row (`Applied` / `Responded` / `Interview`)
   compute days-since-applied and days-past-close from the `Date` and `Closes` columns, and
   prior follow-ups from `data/follow-ups.md`.
2. **Dashboard**, sorted urgent > overdue > waiting > cold:

   ```
   | # | Company | Role | Status | Applied | Closes | F/us | Next due | State |
   ```

   If nothing is actionable: say so and show the next upcoming due dates.
3. **Drafts** — for each overdue/urgent entry only: read the linked report for context, then
   draft a follow-up **in the application's language** (`Lang` column — da ad → Danish,
   en → English):
   - 3–4 sentences, under 120 words, with a subject line. Reference the exact role + when
     applied (or that the ad closed on {date}); ONE concrete value line from the report's
     Tailoring Brief; soft ask with availability.
   - Danish register: polite but low-formality (Danish workplaces use "du", not formal "De") —
     greeting "Kære [navn]," (or "Kære rekrutteringsteam,"); sign-off "Med venlig hilsen,
     [Name]" (the candidate's name from profile.md). No anglicisms where a normal Danish word exists.
   - NEVER "just checking in" / "touching base" / "vil bare lige høre" / "lige følge op".
   - Second follow-up: shorter (2–3 sentences), a NEW angle (project update, relevant
     specifics), never repeats the first.
   - Cold (2 sent, no answer): no third draft — recommend closing or a different contact.
4. **Record** — ONLY what the user confirms as actually sent. Append to
   `data/follow-ups.md`:

   ```markdown
   | # | App# | Date | Company | Role | Channel | Contact | Notes |
   ```

   (`#` = next sequential follow-up number; `App#` = tracker row number; Channel =
   Email / LinkedIn / Portal / Other.) Then add "Follow-up N sent {YYYY-MM-DD}" to the
   tracker row's Notes. Never record a draft as sent.
5. **Summary** — N tracked / N overdue / N urgent / N waiting (next dates) / N cold.
