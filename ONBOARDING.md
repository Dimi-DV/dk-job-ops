# ONBOARDING — fill this in, then run `/dk-job-ops onboard`

This is the single source of truth for setting up the pipeline. Fill in every `[ ]` /
`____` below as completely and **honestly** as you can — the tool will only ever claim what
you write here. When you're done, run **`/dk-job-ops onboard`** in Claude Code (see the bottom
of this file).

> Ground rule: if a skill, tool, certification, title, or experience is not written here, the
> pipeline will **not** put it on your CV, cover letters, or application forms. Nothing is
> invented on your behalf.

---

## 1. Identity

- Full name: `____`
- Email: `____`
- Phone (with country code, e.g. `+45 …`): `____`
- LinkedIn URL: `____`
- GitHub / portfolio URL (optional): `____`
- Based in: [ ] Copenhagen / København  [ ] Other Danish city → `____`

---

## 2. Work authorization  ⚠️ MOST IMPORTANT — read first

This drives the rubric's hard gate and the contact line on every CV. Be exact.

Pick one:

- [ ] **EU/EEA citizen** — no Danish work permit required
- [ ] **Danish citizen**
- [ ] **Holds Danish residence & work permit** (type / valid until: `____`)
- [ ] **Requires sponsorship** to work in Denmark

Available to start from (date): `____`

---

## 3. Languages

- English level: [ ] Native  [ ] Fluent/C1–C2  [ ] Professional/B2  [ ] Basic
- Danish level: [ ] Native  [ ] Fluent/C1–C2  [ ] Professional/B2  [ ] Basic  [ ] None
- **Can you write Danish well enough for a Danish-language CV and cover letter?**
  [ ] Yes  [ ] No (English-only applications)

> If "No", the pipeline applies in English and won't generate Danish candidate-facing text for
> you.

---

## 4. Target field & job families

Which families do you want to target? (Tick all that apply — see `rubric.md` for full anchors.)

- [ ] **F1** Cloud / DevOps
- [ ] **F2** Data / analytics
- [ ] **F3** IT support / BPO / service-desk
- [ ] **F4** Banking / finance ops
- [ ] **F5** Audit / Big4
- [ ] **F6** Corporate operations
- [ ] **F7** Client-facing / account management

Or describe your target roles in your own words: `____`

Seniority you're aiming for (e.g. graduate / junior / 2–4 yrs): `____`

---

## 5. Your real CV  (the ground-truth source)

Paste your current CV below, or attach the file and note its name here. This is what every
tailored CV is built from — include real employers, dates, titles, education, tools, and
certifications.

```
[ paste your CV here — or attach and name the file: ____ ]
```

---

## 6. Anti-claims  (what NOT to claim)

List any tools, technologies, certifications, titles, languages, or domains you do **not** want
on your CV — things you've touched only lightly, or that recruiters might assume but you can't
back up in an interview. The pipeline treats this list as binding.

- `____`
- `____`
- `____`

---

## 7. Salary & dealbreakers

- Salary expectation (**DKK gross / month**): `____`
  *(Danish ads quote gross/måned; salary is never used as a hard filter — this just calibrates fit.)*
- Work mode: [ ] On-site OK  [ ] Hybrid only  [ ] Remote only  [ ] No preference
- Max commute / acceptable locations: `____`
- Sectors or companies to **avoid**: `____`
- Any other dealbreakers: `____`

---

Then run **`/dk-job-ops onboard`** in Claude Code — it fills `profile.md`, `cv-en.md`,
`cv-da.md`, the family bases, and the rubric candidate-snapshot from your answers, with a
ground-truth pass.
