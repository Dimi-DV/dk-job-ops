# Denmark Ladder Score — Triage Rubric

## Purpose

Scores every new Copenhagen/Denmark job posting for ONE candidate (see `profile.md`:
`[DEGREE — FILL IN]`, `[YEARS + DOMAIN OF EXPERIENCE — FILL IN]`, `[SKILLS / PORTFOLIO — FILL IN]`,
`[LANGUAGES — FILL IN]`, `[WORK AUTHORIZATION — FILL IN]`).

**Scoring philosophy (v2, user-set 2026-06-10): the question is NOT "is this a match" — it is
"can he LAND this job, whatever it is, as long as it is not a dead end."** Landability
dominates the score (60%). The only content requirement is vertical growth potential — a
dead-end seat is excluded no matter how easy it is to get (P-gate). Transferability is a
minor tiebreaker, not a filter. CV similarity matters only insofar as it raises the odds of
an offer. Salary is never a gate. **Degree preference (user-set 2026-06-10): among landable
roles, PREFER ads that require a university degree over ads that need only secondary school —
the candidate's degree satisfies the requirement while shrinking the pool he competes in, and
degree-gated roles sit on professional tracks. Encoded as the education-signal modifier below.**

**Two tiers.**
- **Tier 1 — triage (this file).** Run by the daily cloud routine over `data/new/<date>.tsv`.
  Score from the TSV fields ONLY — `title`, `company`, `location`, `posted`, `flags`, `snippet`.
  **Do NOT fetch URLs or search the web.** This file is self-contained: rubric + TSV is
  everything you get. When a field is missing, score conservatively from what's there and
  note the uncertainty (e.g. `A3?`).
- **Tier 2 — full evaluation** (`modes/evaluate.md`). Run locally on user-selected jobs with
  the full JD fetched. Tier 1 never replaces it; Tier 1 only decides what's worth Tier 2.

## Gates (check FIRST — any hit → SKIP, count it, do not score)

| Gate | Rule |
|------|------|
| **X1 Gambling** | Betting/gambling industry is excluded. Operators: Danske Spil, Bet25, Tipico, Betsson, bet365, LeoVegas, Mr Green, Unibet / Kindred — and any title/company/snippet containing `casino`, `kasino`, `betting`, `bookmaker`, `odds`, `væddemål` (NOT a bare `spil`, which appears in unrelated gaming/game-dev roles). |
| **X2 Outbound sales** | Outbound telesales / cold-calling, commission-only comp, MLM/"network marketing". The gate is *outbound selling* — inbound technical support stays in scope via F3, but pure customer-care seats now gate under X6. |
| **X3 Seniority** | JD asks **4+ years**, or title contains **Senior / Lead / Head / Principal / Staff / direktør** → SKIP. Put these rows in the report's own **"Flagged senior"** section (some "senior" ads accept 3 yrs — user decides). **3 yrs required = stretch allowed**, but only when you can cite a concrete asset overlap (e.g. "3 yrs SQL" against a matching asset in `cv-en.md`) — say which asset. |
| **X4 Unbridgeable** | Licensed professions (medicine, law, pharmacy, licensed/**statsautoriseret revisor**, architecture…); **Danish as a hard must-have** is the load-bearing third-language wall in Denmark — many Danish-local / public-sector / SMB ads require full professional Danish, which gates when the candidate's level (`[DANISH LEVEL — FILL IN]`) does not meet it; other third languages (German/French/Italian/Dutch…) as must-have also gate when unheld; mandatory certifications the candidate doesn't hold (verify against `cv-en.md`). "Cert is a plus" / "Danish is a plus" is fine; "required" gates. |
| **X5 Location** | Not Copenhagen and not Denmark-eligible remote (Denmark / EU-remote-incl-Denmark / worldwide-remote). On-site in another Danish city → SKIP. Work authorization (`[WORK AUTHORIZATION — FILL IN]`) can also make an otherwise-eligible role ineligible. |
| **X6 Pure customer support / call center** (user-set 2026-06-11) | Roles whose daily work is customer contact or dispatch coordination with no technical ladder → SKIP: customer care/service representative, call-center/contact-center agent, BPO headset seats (including phone-based "tech support" at large BPO firms), dispatchers, field-service coordinators, retention/renewal agents, "support consultant" phone/chat roles. **Stays IN scope (this is what F3 now means):** support/service-desk *engineer* tracks with a visible L1→L2 path at product/tech companies, product technical support (software vendors, payment processors), database/application support. Test: does the seat fix things, or route calls about them? Routing → X6. |

**No salary gate.** Comp, when stated, is reported informationally against the market table
below — never scored, never a reason to skip.

**A-gate:** after scoring, if **A ≤ 2 → SKIP regardless of the weighted total.** A high P or U
never rescues a role he can't land.

**P-gate (the no-dead-end rule):** if **P = 1 → SKIP regardless of the weighted total.** An
easy-to-land seat with no vertical growth is exactly what the user told us to exclude.

**TIER-1 RECALL-FIRST RULE (added 2026-06-17 after a SKIP-pool audit).** At **Tier 1** you see
only title + snippet — you do NOT know the real requirements. So at Tier 1 the **A-gate and the
A/P/U-from-an-inferred-bar only fire when the title/snippet UNAMBIGUOUSLY shows an unbridgeable
wall**: an explicit gate token (Senior/Lead/Head/Staff/direktør, "4+ yrs", a named required
third language (esp. Danish required), licensed profession, gambling employer, a location
outside Denmark or a named platform that IS the job), OR enriched-snippet evidence (the
LinkedIn/ATS seniority badge + JD excerpt now in the snippet) that confirms it. **Do NOT
hard-SKIP a plausibly professional title on a requirement you merely *assume* from the title** —
a bare "Project Manager" / "Analyst" / "Specialist" with no confirming snippet is **BACKLOG
(uncertain), not SKIP** — let Tier-2 read the JD and decide. A false-SKIP (a missed APPLY that
never gets a Tier-2 read) costs far more than a false-keep (caught and dropped at Tier-2).
*Audit basis: of 16 Tier-1 SKIPs re-scored on the full JD, the one miss was a bare "Project
Manager" whose JD made PM experience "an asset, not required" — A-gated on an assumed bar →
should have been BACKLOG→Tier-2→PRIORITY 4.3.*

## Dimensions (score each 1–5; anchors are written for THIS candidate)

Candidate snapshot for calibration (fill from `profile.md` at onboarding):
`[DEGREE — FILL IN]`; `[YEARS + DOMAIN OF EXPERIENCE — FILL IN, e.g. "2 yrs operations-analyst
data work"]`; `[PORTFOLIO / TECHNICAL PROJECTS — FILL IN]`; `[CORE SKILLS — FILL IN, e.g. Python,
SQL]`; `[LANGUAGES — FILL IN, e.g. English + Danish level]`; `[WORK AUTHORIZATION — FILL IN]`;
`[AVAILABILITY — FILL IN]`.

### A — Landability (weight 0.60 — the dominant dimension)
*What is the probability he gets an OFFER?* **This is explicitly NOT a CV-similarity score** —
a role with a low requirements bar that he can win with zero background overlap scores HIGH.
Similarity to his background only matters when it raises his odds in the applicant pool.

- **5** — Low bar or clear edge: requirements are secondary-diploma / any-degree / no-experience /
  explicit junior/graduate/trainee/**nyuddannet** intake; OR requirements he meets
  outright (`[BASELINE QUALS — FILL IN, e.g. business/quant degree, Excel/SQL/Python, English,
  0–2 yrs analytical work]`); OR one of his rare assets is the core ask (`[RARE ASSETS — FILL IN,
  e.g. native/fluent English, an inspectable technical portfolio]`; or, where it is a genuine edge,
  `[WORK AUTHORIZATION]` — e.g. EU/EEA eligibility against applicants who need sponsorship).
- **3** — Moderate bar: 1–3 yrs or a named tool asked, bridgeable via `profile.md`'s bridge
  map; he is a credible applicant but without a standout edge in this pool.
- **1** — High bar he can't clear: hidden seniority, a must-have with no bridge (domain
  years, a platform that IS the job); or a pool where he has no edge at all.

**Modifiers (apply after the base anchor, clamp to 1–5):**
- **INTERNSHIP HOLD (user-set 2026-06-12):** roles titled **Internship / Intern / Praktik /
  Praktikant** are on hold — he has prior professional experience, an intern seat after an
  analyst job reads as a career step-down, and many intern programs gate on current-student
  status anyway. Triage: cap such rows at **BACKLOG** with the note `(internship — on hold)`;
  never PRIORITY/APPLY while the hold stands. **Unaffected:** trainee / graduate-program /
  nyuddannet / junior intakes (professional cohort entries — keep scoring normally).
- **+1 A** for BPO / international-support roles where **native/fluent English** is the core ask —
  a rare asset in this pool if `[ENGLISH LEVEL — FILL IN]` applies.
- **−1 A** for **junior pure-developer roles at local IT shops** — that segment is saturated
  (junior-open dev ads draw very large applicant pools). His portfolio is
  `[PORTFOLIO FOCUS — FILL IN, e.g. infra/data]`, not feature-dev.
- **+1 A** for **F1/F2** roles where the ad asks for cloud, AWS, Terraform, CI/CD, or
  data-pipeline experience — the portfolio is directly inspectable proof (`[GITHUB/PORTFOLIO — FILL IN]`).

### P — Progression (weight 0.25; **P = 1 is a gate** — see the no-dead-end rule above)
*Will 12–24 months here move him UP a ladder?*

- **5** — Structured ladder visible from the posting alone: graduate scheme / bank intake
  (e.g. Danske Bank, Nordea, Jyske, Nykredit graduate programmes), Big4 cohort
  (associate→senior on a clock), named trainee/rotation program, or explicit L1→L2→L3 support tiers.
- **3** — Real team at a growing or international employer where advancement is normal but
  unnamed: junior analyst on an actual analytics team, junior engineer at an established
  firm, support role with a visible specialist/team-lead track.
- **1** — Dead-end seat: data entry, generic admin, single-function BPO line with no tier
  structure, tiny shop with no one to be promoted into.

### U — Transferability (weight 0.15 — minor tiebreaker, never a filter)
*Does this line on a CV translate 1:1 to the candidate's fallback / home market
(`[HOME / FALLBACK MARKET — FILL IN, e.g. another EU country or the international market]`)?*

- **5** — Globally legible role at a recognized employer: cloud/DevOps/data at an
  international company, Big4 audit/advisory, recognized bank, known product company.
  A recruiter in any market understands the title, the employer, and the stack with zero explanation.
- **3** — Skills transfer but the employer or title needs a sentence of explaining: local
  firm with a real tech/analytics function, hybrid Danish title (e.g. a "...medarbejder" /
  "...konsulent" title), but the daily work (SQL, Python, AWS, reconciliation, audit support) is demonstrable.
- **1** — Locally bound: Denmark-specific regulatory paperwork, local-market admin/sales, work that
  produces no artifact or skill a recruiter outside Denmark ever asks for.

## Score, bands, output

`score = 0.60·A + 0.25·P + 0.15·U` — report to **one decimal, round half up**
(e.g. A5/P3/U2 → 4.05 → 4.1).

**Education-signal modifier (applied to the final score, clamp to 1.0–5.0):**
- **+0.3** when the ad requires a **university degree** — `bachelor`, `kandidat`,
  `professionsbachelor`, `videregående uddannelse`, `degree required`, `diplom` — he meets it
  and it filters the pool. Note it in the line as `(+0.3 deg)`.
- **−0.3** when the ad is explicitly **secondary-only / no education bar** — `gymnasial uddannelse`,
  `erhvervsuddannelse` / `EUD`, `ingen uddannelseskrav`, "high school", "no degree required". Note as `(−0.3 hs)`.
- No signal visible (common at Tier 1 — titles rarely state education) → no modifier;
  Tier 2 (`modes/evaluate.md`) re-applies it from the full JD.

| Band | Range | Action |
|------|-------|--------|
| **PRIORITY** | ≥ 4.0 | Apply **same day** — ATS employers review rolling. |
| **APPLY** | 3.3 – 3.9 | Apply **this week**; family base CV + light tailoring. |
| **BACKLOG** | 2.5 – 3.2 | One-liner in the report; user decides. |
| **SKIP** | < 2.5, gated, A ≤ 2, or P = 1 | One-liner with score + reason in the collapsed "Skipped (scored)" section; gated rows are count-only. |

**Wide-net rule (tune-2026-06-10):** the user explicitly wants a very broad net. When a
professional role sits between SKIP and BACKLOG — a plausible F1–F7 fit but mid-level, vague,
or weakly matched (e.g. an account manager, B2B sales rep, coordinator) — put it in **BACKLOG**,
not SKIP. SKIP is for gated rows, clearly unattainable roles, and non-professional leakage the
scanner missed. Scored-but-skipped rows must still appear as one-liners in the collapsed
section so nothing professional is ever invisible.

**Metadata — every scored posting also gets:**
- `family:` F1–F7 (table below) — picks the base CV.
- `lang:` `en` | `da` — the **language of the ad**; routes which CV is sent
  (`cv-en.md` vs `cv-da.md`). **Language is never a gate** — see `[LANGUAGE PROFICIENCY — FILL IN]` in `profile.md`.
- `closes:` date if the posting states one (Danish boards like Jobindex/Jobnet usually state an
  `ansøgningsfrist`) — drives follow-up cadence.

**Triage line format (used in the daily report buckets):**

```
**Title** — Company · F# · en/da · A4/P5/U3 → 4.1 · posted YYYY-MM-DD · [source](url)
```

## Families F1–F7 (CV emphasis per family)

| # | Family | CV emphasis (what leads) |
|---|--------|--------------------------|
| **F1** | Cloud / DevOps / IT infrastructure | Lead the cloud/infra portfolio (IaC → CI/CD); portfolio links up top. |
| **F2** | Data & Analytics | Lead the data-pipeline + analytics project + SQL/Python; cloud work as supporting evidence. |
| **F3** | Technical IT Support / QA / Service-Desk Engineer (NOT pure call-center — see X6) | **Native/fluent English is the headline**; incident-response / troubleshooting evidence; Linux/networking fundamentals. |
| **F4** | Banking & Financial Services | Degree + monthly reconciliation + Excel/SQL discipline; tech demoted to a supporting grid; usually **Danish-language** CV. |
| **F5** | Audit / Consulting / Big4 cohorts | Degree + statistics coursework + executive reporting; multi-location data validation as fieldwork analog. **Watch autumn intake windows.** |
| **F6** | Corporate Ops / Business Analyst | "Same role, new city" — prior operations/business-analyst experience ports directly; stakeholder reporting. |
| **F7** | Client-facing professional (non-telesales) | Stakeholder management + `[CLIENT-FACING / COMMUNITY EXPERIENCE — FILL IN]`; plain-language explanation of technical topics. |

## Salary reference (INFORMATIONAL ONLY — never affects score)

Danish convention: quoted pay = **gross (brutto) monthly** unless stated otherwise (Danish ads
quote gross / måned). When a posting states comp, report it next to the band below; never gate or score on it.

| Segment | Gross DKK/month (Danish ads quote gross) |
|---------|------------------------------------------|
| Junior IT / DevOps | 32,000 – 45,000 |
| Junior data analyst | 32,000 – 42,000 |
| Junior banking / corporate | 30,000 – 40,000 |
| Big4 junior (first-year) | ~33,000 – 38,000 |
| English-support BPO | 28,000 – 36,000 |
