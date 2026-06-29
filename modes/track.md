# Mode: track — Application Tracker

Reads and maintains `data/applications.md`. No scripts — the table is the database.

## Pull before write

ALWAYS `git pull` before reading or editing — the cloud routine commits to this repo daily;
local edits on a stale checkout create conflicts (CLAUDE.md rule).

## Table format

```markdown
| # | Date | Company | Role | Lang | Closes | Score | Status | PDF | Report | Notes |
```

- `#` — sequential, 3-digit zero-padded; next = max existing + 1. This number also names the
  `jds/{###}-…` and `reports/{###}-…` files.
- `Date` — evaluation date, YYYY-MM-DD.
- `Lang` — `en` | `da` (language of the ad → which CV was/will be sent).
- `Closes` — ad close date (YYYY-MM-DD) or `—`; drives the follow-up cadence.
- `Score` — weighted A/P/U total to one decimal (e.g. `4.1`).
- `Status` — canonical states ONLY (below).
- `PDF` — ✅ / ❌.
- `Report` — link relative to `data/`: `[014](../reports/014-company-2026-06-10.md)`.
- `Notes` — one line: follow-ups sent, role changes, close-date caveats.

**Rules:** never create a second row for an existing company+role — update the existing one.
No markdown bold, no dates, no extra text in the Status field (dates → Date column, anything
else → Notes).

## Canonical states — source of truth: `templates/states.yml`

`Evaluated` → `Applied` → `Responded` → `Interview` → `Offer` | `Rejected` | `Discarded` | `SKIP`

- `Responded` = the company replied (inbound).
- `Discarded` = closed/expired ad (incl. "closed before eval") or candidate withdrew.
- `SKIP` = doesn't fit, don't apply.

## On request

Status updates: edit the row in place (pull first). Overview: show the table plus stats —
total · count per status · per family/lang · average score · % with PDF · % Applied of
Evaluated · rows whose `Closes` falls in the next 7 days (apply-before-close reminders).
