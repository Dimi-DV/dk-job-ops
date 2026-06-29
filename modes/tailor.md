# Mode: tailor — Per-Job CV PDF (bilingual)

One bespoke CV per pursued posting. Input: a report/tracker number (`tailor 014`) or an
evaluation already in context (run `modes/evaluate.md` first if there is none — the Tailoring
Brief drives this mode). Load `profile.md` (tailoring policy, GROUND-TRUTH RULE, anti-claims)
before touching anything.

## Step 1 — Language + base file

- **CV language = language of the ad** — take `lang` from the report's Machine Summary. The
  rule lives in profile.md: ambiguous/bilingual ad → EN for IT, international employers, Big4;
  DA for Danish-local, public-sector, and SMB roles. Danish CVs use Danish section headers and
  must render æ/ø/å correctly (see Step 5).
- **Base:** `templates/bases/f{N}-{lang}.md` for the report's family (e.g. `f4-da.md` for a
  bank ad in Danish). If that base doesn't exist yet, fall back to `cv-en.md` (EN) /
  `cv-da.md` (DA) and tailor from scratch — note the missing base in your output.

## Step 2 — Patch per the Tailoring Brief (patch, don't regenerate)

- **Headline** → match the posting's title ("Junior Data Analyst", "Dataanalytiker",
  "Technical Support Engineer"…).
- **Summary** → 3–4 lines in the ad's language: JD keywords + the exit narrative from
  profile.md.
- **Skill / competency order** → JD-priority first; 6–8 grid items using the JD's exact
  vocabulary where the underlying asset is real (bridge map in profile.md).
- **Bullet order** → most JD-relevant bullet first in each section; relabel with JD wording,
  never invent. Project order per the family table in `rubric.md` (each family leads with its
  most relevant project and demotes the rest to a supporting grid).

## Step 3 — GROUND-TRUTH check pass (mandatory, never skip)

Re-read the finished draft line by line against `cv-en.md` / `cv-da.md`: every skill, tool, OS,
platform, certification, employer, date, and metric must literally exist there. Then check the
anti-claims list in profile.md (no unearned certifications, no invented metrics or years of
experience, no titles/employers not on the CV, no "production at scale"…). Anything that
fails → cut it or relabel to what is actually on the CV. This applies identically in both
languages.

## Step 4 — Render the PDF

1. Fill `templates/cv-template.html` placeholders: `{{LANG}}` = `da`|`en`, `{{PAGE_WIDTH}}` =
   `210mm` (A4), contact fields from the profile.md identity block. **Phone MUST render with its
   country code** (the `[+CC phone]` slot from profile.md) — a bare local number is uncallable
   internationally. Verify it before rendering. For a Danish CV the `{{SECTION_*}}` placeholders
   take Danish headers — Profil / Kompetencer / Erfaring / Projekter / Uddannelse; English CVs
   keep English headers.
   Two template quirks to handle every time:
   - **No `{{HEADLINE}}` placeholder exists** — inject the Step-2 headline yourself as a
     styled line between `<h1>` and `<div class="header-gradient">` (Space Grotesk, ~13px,
     the section-title teal).
   - **Remove the CERTIFICATIONS section block entirely** (`{{SECTION_CERTIFICATIONS}}` +
     `{{CERTIFICATIONS}}` and their wrapping `<div class="section">`): he holds no
     certifications (anti-claims in profile.md), and an empty section or an "in progress"
     entry must never ship.
2. Write the HTML to `/tmp/cv-{name-slug}-{company-slug}.html` (`{name-slug}` = the candidate's
   name from profile.md, lowercased + hyphenated).
3. Render (CLI: `node generate-pdf.mjs <input.html> <output.pdf> [--format=letter|a4]`):

   ```bash
   node generate-pdf.mjs /tmp/cv-{name-slug}-{company-slug}.html \
     output/cv-{name-slug}-{company-slug}-{da|en}-{YYYY-MM-DD}.pdf --format=a4 --fit
   ```

   **Always `--format=a4`** (Danish/EU employers) **and always `--fit`** (added 2026-06-11):
   the script binary-searches the print scale (1.0→0.8) until the CV fits 1 page — so write
   the HTML **once** and render **once**; NEVER hand-iterate trim-and-re-render passes (that
   loop was the single biggest token+time sink in batch tailoring). Only if the script exits
   3 with "COULD NOT FIT" does content actually need cutting — cut the least JD-relevant
   bullet/project and re-run. The ATS sanitizer converts em-dashes/middots/arrows in body
   text to ASCII; that is expected and **Danish diacritics (æ ø å) pass through untouched**.

## Step 5 — Diacritics verification (DA PDFs only)

The latin-ext fonts in `fonts/` cover æ ø å, but verify the text actually carries them —
inspect the intermediate HTML:

```bash
grep -o '[æøåÆØÅ]' /tmp/cv-{name-slug}-{company-slug}.html | sort | uniq -c
```

Zero matches on a Danish CV almost always means the source text was ASCII-folded somewhere
(æ→ae, ø→oe, å→aa) — fix the markdown/HTML, re-render, do not ship. Optionally confirm the PDF
text layer too (`pdftotext output/….pdf - | grep -c '[æøå]'` if available, else eyeball the PDF).

## Step 6 — Cover letter (ONLY if the USER asks — user rule 2026-06-11)

If the ad requires a cover letter (ansøgning), FLAG it in your output and stop — never draft
unbidden, it wastes tokens on letters most posts don't need.

Cover letter per profile.md: **200–250 words, same language as the ad.** Danish register —
greeting "Kære [navn]," (or "Kære rekrutteringsteam,"), sign-off "Med venlig hilsen, [Name]".
Lead with what was built — ONE concrete technical decision for technical roles (F1–F3); the
strongest business outcome for F4–F7. No "passionate", no "I would love the opportunity". Save
as `output/cover-letter-{company-slug}-{YYYY-MM-DD}.md` next to the PDF.

## Step 7 — Track

Pull, then update the tracker row: PDF ✅; write the PDF path into the report's Machine
Summary `cv:` field. Report the PDF path, page count, and which Tailoring-Brief items were
addressed.
