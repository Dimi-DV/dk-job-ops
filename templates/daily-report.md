<!-- templates/daily-report.md — skeleton the cloud triage fills.
     Written to data/daily/{YYYY-MM-DD}.md. {curly} tokens = fill; drop empty sections
     EXCEPT the header, failures line, and footer, which always appear.
     Bucket line format is canonical in rubric.md ("Triage line format"). -->

# Daily scan — {YYYY-MM-DD}

**{new} new** ({scanned} scanned · {dupes} duplicates) · **{p} PRIORITY** · {a} APPLY · {b} BACKLOG · {skip} skipped · {senior} flagged senior
**Providers:** {ok}/{total} ok{; failed: {provider} ({reason}), …}{; soft-fail: {provider}}{; skipped: {provider} ({reason})}

## PRIORITY (≥ 4.0 — apply same day)

**{Title}** — {Company} · F{#} · {sr/en} · A{n}/P{n}/U{n} → {score} · posted {YYYY-MM-DD} · [{source}]({url})

## APPLY (3.3–3.9 — this week)

**{Title}** — {Company} · F{#} · {sr/en} · A{n}/P{n}/U{n} → {score} · posted {YYYY-MM-DD} · [{source}]({url})

## BACKLOG (2.5–3.2 — user decides)

**{Title}** — {Company} · F{#} · {sr/en} · A{n}/P{n}/U{n} → {score} · posted {YYYY-MM-DD} · [{source}]({url})

## Flagged senior (X3 — SR "senior" ads sometimes take 3 yrs; user decides)

**{Title}** — {Company} · {sr/en} · flags: {flags} · posted {YYYY-MM-DD} · [{source}]({url})

<details><summary>Skipped (scored) — {n} rows, audit list</summary>

- {Title} — {Company} · {score} · {one-phrase reason} · [{source}]({url})

</details>

## Filtered out (gated — count only)

| Reason | Count |
|--------|-------|
| X1 gambling | {n} |
| X2 outbound sales | {n} |
| X3 senior (gated) | {n} |
| X4 unbridgeable | {n} |
| X5 location | {n} |
| Non-professional title | {n} |

<!-- Only if the routine hit its runtime limit before triaging everything: -->
## Untriaged ({n} rows — ran out of time; raw rows in data/new/{date}.tsv)

---
next: `/dk-job-ops review`
