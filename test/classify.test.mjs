#!/usr/bin/env node
// test/classify.test.mjs — fixture tests for scan.mjs classify()/normalize()
// against the REAL portals.yml filter config. Plain node script, no framework:
//   node test/classify.test.mjs
// Exits 1 on any failure; prints a PASS/FAIL summary.

import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { normalize, classify, prepareFilters } from '../scan.mjs';

const cfg = yaml.load(readFileSync(new URL('../portals.yml', import.meta.url), 'utf-8'));
const filters = prepareFilters(cfg.filters);

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) { pass++; }
  else { fail++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); }
}

// ── normalize() unit checks — Danish folding (æ→ae, ø→o, å→a) ────────
check('normalize: rengøring → rengoring (ø fold)', normalize('Rengøring') === 'rengoring', `got "${normalize('Rengøring')}"`);
check('normalize: æ → ae (hjælper)', normalize('Hjælper') === 'hjaelper', `got "${normalize('Hjælper')}"`);
check('normalize: å → a (Århus)', normalize('Århus') === 'arhus', `got "${normalize('Århus')}"`);
check('normalize: KØBENHAVN → kobenhavn', normalize('KØBENHAVN') === 'kobenhavn', `got "${normalize('KØBENHAVN')}"`);
check('normalize: æ/ø/å folded together', normalize('ÆØÅ æøå') === 'aeoa aeoa', `got "${normalize('ÆØÅ æøå')}"`);
// Token-collision guard: 'montor' (montør) must not be conjured by folding a
// professional title — kontorassistent (office) must NOT contain "montor".
check('normalize: kontorassistent does NOT contain "montor"',
  !normalize('Kontorassistent').includes('montor'),
  `normalized="${normalize('Kontorassistent')}"`);

// ── classify() fixtures ─────────────────────────────────────────────
// expect: 'keep' | 'drop'; reason: 'title' | 'company' prefix match; flag: must appear in flags.
const cases = [
  // — professional KEEPS —
  { title: 'DevOps Engineer', expect: 'keep' },
  { title: 'Junior forretningsanalytiker', expect: 'keep' },
  { title: 'Dataanalytiker', expect: 'keep' },
  { title: 'Kreditanalytiker', expect: 'keep' },
  { title: 'QA Engineer', expect: 'keep' },
  { title: 'Customer Support Agent (English)', expect: 'keep' }, // 'call center agent' must not catch bare "agent"
  { title: 'IT-supporter', expect: 'keep' },
  { title: 'IT Support Specialist', expect: 'keep' },
  { title: 'Systemadministrator', expect: 'keep' },              // 'administrerende' must not catch "administrator"
  { title: 'Cloud Engineer (AWS)', expect: 'keep' },
  { title: 'Bogholder', expect: 'keep' },
  { title: 'Graduate Trainee – Banking', expect: 'keep' },
  { title: 'Financial Analyst', expect: 'keep' },                // 'chief financial' must not catch bare "financial"
  { title: 'Business Analyst', expect: 'keep' },
  { title: 'Backend Developer (Java)', expect: 'keep' },
  { title: 'Project Coordinator', expect: 'keep' },              // 'director' must not catch "coordinator"
  { title: 'Operations Analyst', expect: 'keep' },
  { title: 'Linux Server Administrator', expect: 'keep' },
  // — gambling-token guards: game DEVELOPER is in-scope, must NOT hit a gambling token —
  { title: 'Spiludvikler', expect: 'keep' },                     // no bare 'spil' token → game dev kept
  { title: 'Game Developer (Unity)', expect: 'keep' },           // 'game presenter' must not catch "game developer"
  // — filter-tuning guards: professional siblings the bare/compound tokens must NOT drop —
  { title: 'Data Warehouse Analyst', expect: 'keep' },           // compound 'warehouse worker'… must not hit bare "warehouse"
  { title: 'Data Warehouse Engineer', expect: 'keep' },
  { title: 'Device Driver Developer', expect: 'keep' },          // compound 'delivery driver'… must not hit bare "driver"
  { title: 'ADAS Driver Assistance Software Engineer', expect: 'keep' },
  { title: 'Lagerstyring Analytiker', expect: 'keep' },          // 'lagermedarbejder' must not hit "lager"-prefixed pro titles
  { title: 'Produktionsingeniør', expect: 'keep' },              // 'produktionsmedarbejder' must not hit "produktionsingeniør"
  { title: 'Monitoring Engineer', expect: 'keep' },              // 'montor' (montør) must not hit "monitoring"
  { title: 'Salgskonsulent', expect: 'keep' },                   // 'telesalg' must not hit bare "salg"
  { title: 'Sales Representative', expect: 'keep' },

  // — title DROPS (Danish manual; several need æ/ø/å folding) —
  { title: 'Rengøringsassistent', expect: 'drop', reason: 'title' },     // needs the ø→o fold
  { title: 'Rengøringsmedarbejder', expect: 'drop', reason: 'title' },
  { title: 'Chauffør til distribution', expect: 'drop', reason: 'title' }, // needs the ø→o fold
  { title: 'Lagermedarbejder', expect: 'drop', reason: 'title' },
  { title: 'Lagerarbejder (m/k)', expect: 'drop', reason: 'title' },
  { title: 'Tjener søges', expect: 'drop', reason: 'title' },
  { title: 'Køkkenmedarbejder', expect: 'drop', reason: 'title' },       // needs the ø→o fold
  { title: 'Opvasker til restaurant', expect: 'drop', reason: 'title' },
  { title: 'Produktionsmedarbejder', expect: 'drop', reason: 'title' },
  { title: 'Fabriksarbejder', expect: 'drop', reason: 'title' },
  { title: 'Montør til produktion', expect: 'drop', reason: 'title' },   // needs the ø→o fold
  { title: 'Flyttemand søges', expect: 'drop', reason: 'title' },
  { title: 'Sikkerhedsvagt', expect: 'drop', reason: 'title' },
  { title: 'Pedel til skole', expect: 'drop', reason: 'title' },
  { title: 'Postbud i København', expect: 'drop', reason: 'title' },
  { title: 'Cykelbud (deltid)', expect: 'drop', reason: 'title' },       // bare 'bud' would catch "budget" — token is "cykelbud"
  { title: 'Avisbud søges', expect: 'drop', reason: 'title' },
  { title: 'Barista til café', expect: 'drop', reason: 'title' },
  { title: 'Bartender', expect: 'drop', reason: 'title' },
  { title: 'Social- og sundhedshjælper', expect: 'drop', reason: 'title' }, // needs the æ→ae fold (token is folded)

  // — title DROPS (EN — DK boards carry many English ads) —
  { title: 'Cleaner', expect: 'drop', reason: 'title' },
  { title: 'Delivery Driver', expect: 'drop', reason: 'title' },
  { title: 'Truck Driver', expect: 'drop', reason: 'title' },
  { title: 'Warehouse Worker', expect: 'drop', reason: 'title' },
  { title: 'Warehouse Operative', expect: 'drop', reason: 'title' },
  { title: 'Forklift Operator', expect: 'drop', reason: 'title' },
  { title: 'Security Guard', expect: 'drop', reason: 'title' },
  { title: 'Cashier', expect: 'drop', reason: 'title' },
  { title: 'Housekeeping Supervisor', expect: 'drop', reason: 'title' },
  { title: 'Courier', expect: 'drop', reason: 'title' },
  { title: 'Waiter', expect: 'drop', reason: 'title' },
  { title: 'Waitress', expect: 'drop', reason: 'title' },

  // — gambling / live-casino TITLES (on neutral companies) —
  { title: 'Casino Dealer', expect: 'drop', reason: 'title' },
  { title: 'Kasino medarbejder', expect: 'drop', reason: 'title' },
  { title: 'Live Dealer (English-speaking)', expect: 'drop', reason: 'title' },
  { title: 'Game Presenter', expect: 'drop', reason: 'title' },           // gambling title on a neutral company
  { title: 'Croupier', expect: 'drop', reason: 'title' },
  { title: 'Betting Analyst', expect: 'drop', reason: 'title' },

  // — telesales / cold-call gates —
  { title: 'Telesalgskonsulent', expect: 'drop', reason: 'title' },
  { title: 'Telemarketingmedarbejder', expect: 'drop', reason: 'title' },
  { title: 'Telefoninterviewer', expect: 'drop', reason: 'title' },
  { title: 'Call Center Agent', expect: 'drop', reason: 'title' },

  // — director-level seniority gates —
  { title: 'Salgsdirektør', expect: 'drop', reason: 'title' },            // needs the ø→o fold
  { title: 'Administrerende direktør', expect: 'drop', reason: 'title' },
  { title: 'Director of Engineering', expect: 'drop', reason: 'title' },
  { title: 'Head of Marketing', expect: 'drop', reason: 'title' },
  { title: 'Chief Technology Officer', expect: 'drop', reason: 'title' },
  { title: 'Chief Financial Officer', expect: 'drop', reason: 'title' },

  // — company DROPS (gambling / betting operators licensed in DK) —
  { title: 'Java Developer', company: 'Danske Spil A/S', expect: 'drop', reason: 'company' },
  { title: 'Data Analyst', company: 'Unibet Group', expect: 'drop', reason: 'company' },
  { title: 'DevOps Engineer', company: 'Betsson Group', expect: 'drop', reason: 'company' },
  { title: 'Backend Developer', company: 'LeoVegas Mobile Gaming', expect: 'drop', reason: 'company' },
  { title: 'QA Engineer', company: 'Kindred Group', expect: 'drop', reason: 'company' },
  { title: 'Frontend Developer', company: 'Mr Green & Co', expect: 'drop', reason: 'company' },
  { title: 'Software Engineer', company: 'Spillehallen ApS', expect: 'drop', reason: 'company' }, // 'spillehal'
  { title: 'Data Engineer', company: '888 Holdings', expect: 'drop', reason: 'company' },
  // company exclude fires BEFORE the title check:
  { title: 'IT Support', company: 'Casino Munkebjerg', expect: 'drop', reason: 'company' },       // title alone would keep
  { title: 'Game Presenter Team Lead', company: 'Danske Spil A/S', expect: 'drop', reason: 'company' },

  // — FLAGS: kept but tagged —
  { title: 'Senior DevOps Engineer', expect: 'keep', flag: 'senior' },
  { title: 'Lead Data Engineer', expect: 'keep', flag: 'lead' },
  { title: 'Principal Software Engineer', expect: 'keep', flag: 'principal' },
  { title: 'Staff Engineer, Platform', expect: 'keep', flag: 'staff engineer' },
  { title: 'Cloud Expert', expect: 'keep', flag: 'expert' },
  { title: 'Ledende systemudvikler', expect: 'keep', flag: 'ledende' }, // Danish "leading/senior"
];

for (const c of cases) {
  const job = { title: c.title, company: c.company || 'Acme A/S' };
  const res = classify(job, filters);
  const label = `classify: "${c.title}"${c.company ? ` @ ${c.company}` : ''}`;
  if (res.action !== c.expect) {
    check(label, false, `expected ${c.expect}, got ${res.action}${res.reason ? ` (${res.reason})` : ''}`);
    continue;
  }
  if (c.reason && !(res.reason || '').startsWith(`${c.reason}:`)) {
    check(label, false, `expected reason ${c.reason}:*, got ${res.reason}`);
    continue;
  }
  if (c.flag && !res.flags.includes(c.flag)) {
    check(label, false, `expected flag "${c.flag}", got [${res.flags.join(',')}]`);
    continue;
  }
  if (c.expect === 'keep' && !c.flag && res.flags.length > 0) {
    check(label, false, `unexpected flags [${res.flags.join(',')}]`);
    continue;
  }
  check(label, true);
}

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${pass + fail} checks: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('ALL PASS');
