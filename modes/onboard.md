# Mode: onboard — Build the Candidate Layer

One-time setup that turns the friend's raw CV + his `ONBOARDING.md` answers into the
**candidate layer** every other mode reads: `profile.md`, `cv-en.md` + `cv-da.md`, the
`templates/bases/f{1..6}-{en,da}.md` family bases, and the candidate-snapshot + anti-claims
slots in `rubric.md`. Run it ONCE before the first `review`; re-run to refresh after a CV
change. **Hard rule: nothing enters any generated file that isn't in his source — this mode
SETS the ground truth, it never invents it.**

## Step 0 — Gather sources

1. Read `ONBOARDING.md` (his filled-in intake answers) and the raw CV he dropped in (PDF,
   DOCX, or pasted text — the Read tool reads PDFs/images; ask him to paste if it's a format
   you can't open). These two are the ONLY source of truth for everything below.
2. If either is missing or mostly blank, STOP and ask him to complete `ONBOARDING.md` first —
   never proceed on guesses.

## Step 1 — Confirm the two load-bearing facts (these gate everything)

Before writing a single file, get explicit answers — they drive rubric gates X4/X5, the CV
contact line, and the apply-form work-auth answer:

1. **Work authorization** — exact status. Resolve the `[WORK AUTHORIZATION]` slot to ONE of:
   "EU/EEA citizen — no work permit required" · "Holds Danish residence & work permit" ·
   "Requires sponsorship" (or his precise wording). NEVER assume EU citizenship or a permit.
2. **Danish-language level** — native / fluent / professional / conversational / none. This
   decides whether `cv-da.md` and the `*-da.md` bases are real working CVs or thin
   placeholders, and sets the EN-vs-DA ambiguity default (EN-first if his Danish is low).

If either is unstated in `ONBOARDING.md`, ask now and wait — do not infer.

## Step 2 — Fill `cv-en.md` (the EN ground truth)

Replace every `[FILL IN]` / `[VERIFY]` slot with his real data; keep the section order and the
`[FILL IN]/[VERIFY]` HTML-comment legend at the top of the file:

- **Contact line:** `[Headline] · [City], Denmark · [resolved WORK AUTHORIZATION] · [email] ·
  [phone +CC] · [LinkedIn] · [GitHub/portfolio]` — Copenhagen unless his intake says otherwise.
- **Summary / Projects / Skills / Experience / Education** — only what the raw CV supports; map
  education to Danish tokens where useful (kandidat / bachelor / professionsbachelor / EUD).
- List ONLY tools/skills he genuinely has — this set is the ceiling for every tailored CV.

## Step 3 — Mirror to `cv-da.md`

Translate `cv-en.md` into Danish in the SAME session (mirror rule). Danish section headers:
**Profil / Kompetencer / Erfaring / Projekter / Uddannelse**. Verify æ/ø/å are real characters,
not ASCII folds (ae/oe/aa). If his Danish level is low (Step 1), keep `cv-da.md` minimal and
flag it EN-preferred in profile.md — never invent fluency he doesn't have.

## Step 4 — Write `profile.md`

Fill its `[FILL IN]` slots from the raw CV + intake:

- **Identity** block — name, email, phone +CC, LinkedIn, GitHub/portfolio, location, resolved
  work authorization, availability.
- **Exit story / narrative** — one honest paragraph from his real history; frames all
  candidate-facing text.
- **Proof points** — 4–7, each supportable verbatim from the raw CV (project, role outcome,
  metric); no rounding up, no invented numbers or counts.
- **Bridge map** — his real assets → the families F1–F7 they bridge to.
- **Anti-claims** — the explicit "NEVER assert" list for HIM: certs he hasn't earned,
  titles/years he doesn't hold, customer-facing or scale claims his roles don't support.
  Derive these from the gaps between his raw CV and common JD asks — they are guardrails,
  never new claims.
- Keep the GROUND-TRUTH RULE, language rule, cover-letter rule, and writing-style sections
  intact — they are the product's spine; only the candidate facts change.

## Step 5 — Family bases `templates/bases/f{1..6}-{en,da}.md`

For each family F1–F6 his background can credibly target, derive a base CV from
`cv-en.md` / `cv-da.md` — reordered + re-headlined for that family, NO facts added beyond the
source CVs. Skip families he can't credibly reach (say which). **F7 has no base — it falls
back to `cv-en.md` / `cv-da.md`.** Mirror each EN base into its DA twin in the same pass.

## Step 6 — `rubric.md` candidate slots

Update ONLY the candidate-specific slots, never the scoring machinery:

- The **candidate-snapshot** calibration line (under "Dimensions") — one sentence: his degree,
  experience, hard skills, languages, and resolved work-authorization.
- Any **anti-claims / gate** references that named the previous candidate → his real status.
- Leave gate logic, A/P/U anchors, bands, families, and the salary table untouched.

## Step 7 — GROUND-TRUTH pass (mandatory, never skip)

Re-read every file written above line by line against the raw CV + `ONBOARDING.md`. Every
skill, tool, employer, title, date, metric, language level, and the work-auth line must trace
to his source. Anything that can't → cut it or relabel to what is real. Confirm the mirror
holds (cv-en ↔ cv-da, and each base EN ↔ DA).

## Output

- List every file created/updated.
- State the resolved **work authorization** and **Danish level** in one line each.
- Flag any slot you could NOT fill (absent from his source) as an open `[FILL IN]` for him to
  complete — never paper over a gap.
- Point him to the next step: `/dk-job-ops review` (or paste a JD to evaluate).
