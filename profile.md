# Profile — [FULL NAME] (Denmark search)

Who the candidate is and how to represent them. `cv-en.md` (EN) and `cv-da.md` (DA) are
the ground truth for what may appear in any tailored CV. Fill every `[FILL IN]` slot
during onboarding (`/dk-job-ops onboard`) before generating any candidate-facing document.

## Identity

| Field | Value |
|-------|-------|
| Name | [FILL IN — full name exactly as it should appear on the CV] |
| Email | [FILL IN — email address] |
| Phone | [FILL IN — phone with country code, e.g. +45 …] |
| LinkedIn | [FILL IN — linkedin.com/in/… ; omit if none] |
| GitHub | [FILL IN — github.com/… or other code portfolio; omit if none] |
| Website | [FILL IN — portfolio/personal site; leave blank if none] |
| Work authorization | [WORK AUTHORIZATION — e.g. "EU/EEA citizen — no work permit required" OR "Holds Danish residence & work permit" OR "Requires sponsorship"] |
| Location | [FILL IN — base city, e.g. Copenhagen, Denmark] · [FILL IN — availability, e.g. "available immediately"] |

## Exit story / narrative (frames ALL candidate-facing content)

> [FILL IN — one-paragraph career arc: education → prior role(s) → key build/skill → why
> you are targeting the Danish market now. This is the spine every summary and cover letter
> draws from; keep it factual and verifiable against `cv-en.md`.]

Position as [FILL IN — seniority framing, e.g. "a high-ceiling early-career hire" or
"an experienced X"]. Emphasize [FILL IN — 2–3 selling angles: ramp speed, domain rigor,
languages, …]. Never frame as more senior than the ground truth supports.

## Proof points (each must be verifiable against `cv-en.md`)

Fill 3–7 concrete, defensible proof points — each a specific build, result, or experience
with a citable detail (a number, a named system, a decision-under-uncertainty arc). These
are your STAR stories; never invent metrics.

1. [FILL IN — proof point: what was built/done, the concrete result, the citable detail]
2. [FILL IN — proof point]
3. [FILL IN — proof point]
4. [FILL IN — proof point]
5. [FILL IN — optional]
6. [FILL IN — optional]
7. [FILL IN — optional]

## CV tailoring policy — per posting, aggressive but defensible

For every pursued posting generate ONE bespoke CV fit to THAT posting (starting from the
family base in `templates/bases/`). The JD's responsibilities and keywords drive the
headline, summary, project order, and competency grid.

**ALLOWED — be aggressive:**
- Adopt the JD's exact vocabulary for skills the candidate genuinely has — relabel a REAL
  asset to the JD's term (e.g. map IaC experience to the JD's "configuration management",
  monitoring work to "observability", reconciliation work to "settlement"/"afstemning").
  [FILL IN your own asset→JD-term mappings during onboarding.]
- Present portfolio / self-directed builds as **equivalent hands-on capability** — they are
  real builds.
- Foreground transferable/adjacent experience as directly relevant to the posting's daily work.
- Claim light/in-progress familiarity ONLY for tools already on the CV.
- Fully reorder, re-headline, rewrite the summary, and match the headline title to the
  posting.

**GROUND-TRUTH RULE (hard line — enforce on EVERY generated CV, both languages):**
A skill, tool, OS, platform, certification, or work experience may appear in a CV **only if
it is literally present in `cv-en.md` / `cv-da.md`.** The JD's vocabulary may RELABEL what's
there; it may NEVER ADD what isn't. If the CV doesn't contain it, it does not enter the CV —
full stop. "Aggressive" means foreground + relabel REAL assets; it is never license to
invent. When the JD needs something the candidate lacks (a named platform, a BI tool, a
language), name it as a **gap to learn**, never as a held skill.

**Anti-claims (NEVER assert — fill these guardrails during onboarding):**

List every tool, certification, title, metric, or experience the candidate must NOT claim,
even when a posting asks for it. These are the hard lines that keep tailoring honest.
Replace the bracketed prompts below with the candidate's real guardrails:

- [FILL IN — no fabricated employment, titles, dates, or years of experience: state the
  true tenure / seniority ceiling here]
- [FILL IN — certifications the candidate does NOT hold and must never claim]
- [FILL IN — experience types to never claim (e.g. "role X was INTERNAL, not
  customer-facing"; no "24×7 / on-call / shift"; no named ITSM/ticketing tools not on the CV)]
- [FILL IN — breadth limits (e.g. OS/admin scope; "no production systems at scale";
  "never led a team")]
- [FILL IN — no invented metrics or counts: list any soft numbers and exactly how they must
  be stated]
- [FILL IN — caveats to keep ready if a portfolio project is probed]

## Bridge map (candidate asset → what it bridges to → families)

Fill one row per real asset: what it is, the JD concepts it honestly bridges to, and which
families (F1–F7) it serves. F1 Cloud/DevOps · F2 Data/analytics · F3 IT support/BPO ·
F4 Banking/finance ops · F5 Audit/Big4 · F6 Corporate operations · F7 Client-facing/account.

| Candidate asset | Bridges to… | Families |
|-----------------|-------------|----------|
| [FILL IN — asset] | [FILL IN — JD concepts it honestly bridges to] | [F? — e.g. F1, F3] |
| [FILL IN — asset] | [FILL IN] | [F?] |
| [FILL IN — asset] | [FILL IN] | [F?] |
| [FILL IN — asset] | [FILL IN] | [F?] |
| [FILL IN — asset] | [FILL IN] | [F?] |

## Language rule (CV routing)

- **CV language = language of the ad** (the review step's `lang` tag pre-decides; never a gate).
- Ambiguous/bilingual ad → **EN** for IT, international employers, and Big4; **Danish** for
  Danish-local employers, public sector, and SMBs.
- The GROUND-TRUTH RULE applies identically in both languages; `cv-da.md` mirrors `cv-en.md`
  and any `cv-en.md` edit must be mirrored there in the same session (note: æ/ø/å must render
  correctly in the generated PDF).

## Cover letter (følgebrev)

**ONLY when the candidate explicitly asks for one** — never auto-write, not even when the ad
requires it: surface the requirement ("this ad asks for a cover letter") and wait for the
go-ahead. When asked: **200–250 words, same language as the ad.** Concise, specific: lead
with a concrete build/outcome and ONE specific decision for technical roles; for F4–F7, lead
with a business outcome instead. Danish register: greeting "Kære [navn]," (or "Kære
rekrutteringsteam,"); sign-off "Med venlig hilsen, [Name]". Danish workplaces use "du", not
formal "De". No "I am passionate about," no "I would love the opportunity."

## Writing style (candidate-facing text only)

CV bullets: direct action+tool+outcome, 1–2 lines, quantify where the ground truth supports
it. No "Responsible for" / "Helped with." Tone confident, no hedging. Prefer "built/ran/cut"
over "developed/led/reduced." Avoid: "passionate," "leveraged," "spearheaded," "synergies,"
"robust," "seamless."
