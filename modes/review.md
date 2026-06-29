# Mode: review — Morning Daily-Report Walk

Entry point of the daily loop. The cloud routine scans + triages overnight and commits
`data/daily/{today}.md`; this mode walks that report with the user and turns picks into
evaluations, PDFs, and tracker rows. The user **always sends applications himself**.

## Step 0 — Pull before anything

`git pull` first. The cloud agent commits `data/` daily — never read or write tracker/data
files on a stale checkout (CLAUDE.md pull-before-write rule).

## Step 1 — Load the report

Read `data/daily/{today}.md`. If today's file is missing, use the newest file in `data/daily/`
and say so explicitly — the routine may have failed; check the report's failures line and
`data/new/{date}.providers.json` for provider status. Also glance at `data/pipeline.md` — any
unprocessed URLs in the inbox join the queue as implicit picks.

## Step 2 — Present PRIORITY first

For each PRIORITY item show its number, the triage line
(`**Title** — Company · F# · en/da · A4/P5/U3 → 4.1 · posted · [source](url)`), plus **one
line on why it scored** — the strongest dimension and the family logic, derived from the line's
A/P/U against `rubric.md` (no URL fetching at this stage). Then the APPLY bucket as a compact
table, BACKLOG one-liners as-is, the Flagged-senior count (surface any with an obvious asset
overlap per rubric X3), and the filtered-out counts in one line.

## Step 3 — Queue the picks

Ask which items to pursue — accept "1, 3, 4", "all priority", "priority + the Danske Bank one",
"skip today". Build an ordered queue.

## Step 4 — Process the queue (sequential)

For each pick run the full chain:

1. `modes/evaluate.md` — Tier-2 eval: liveness check, **save the JD**, re-score, report,
   tracker row `Evaluated`.
2. If the band holds at PRIORITY/APPLY and the user confirms → `modes/tailor.md` — tailored
   PDF in the ad's language.
3. Tracker updated as each step completes.

One-line progress note between items. Never apply for him — `modes/apply.md` exists for form
help, but the click is his.

## Variant: `review blitz`

Process **EVERY PRIORITY item** in parallel via subagents — for mornings with a deep PRIORITY
bucket. The user still reviews and sends every application manually.

**Orchestrator (this session):**

1. Pull; read the report; list the PRIORITY items.
2. **Pre-assign report numbers** `{###}` sequentially (next tracker number onward, one per
   item) BEFORE spawning, so `jds/` and `reports/` filenames never collide.
3. Spawn one subagent (Task tool) per PRIORITY item. Each subagent prompt embeds: the item's
   triage line + URL, its assigned `{###}`, and pointers to read `rubric.md`, `profile.md`,
   `modes/evaluate.md`, `modes/tailor.md`. Each subagent does:
   - **Short Tier-2 eval** — evaluate.md compressed: liveness check, save the JD to `jds/`,
     re-score A/P/U, Tailoring Brief, Machine Summary, save the report (cap the employer
     snapshot at 1 web search; skip it for known employers).
   - **NO tailored PDF by default** (policy 2026-06-11): the blitz stops at evaluation —
     the user sends ~30-40% of scored jobs, so eager batch PDFs waste most of the render
     cost. PDFs are generated per-case via `/dk-job-ops tailor {###}` when he picks an item
     to send. Only tailor in-blitz if the user explicitly asks for "blitz with PDFs".
   - **Return its tracker row as text** — subagents must NOT edit `data/applications.md`
     (single-writer rule; parallel edits corrupt the table).
4. After all subagents return, append all tracker rows in ONE edit, in number order.
5. Summarize: N evaluated, M PDFs generated, any items that died at liveness or dropped band
   on full-JD scoring, table of bands + report/PDF paths. Hand the send-list to the user.

## Feedback loop

When the user says a triage score was wrong ("this should never be PRIORITY", "you keep
missing X"), capture the pattern and propose a concrete edit to `rubric.md` anchors or
`portals.yml` filters — the first weeks of reports will need 2–3 tuning passes.
