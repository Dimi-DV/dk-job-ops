#!/usr/bin/env node
// test/jooble.test.mjs — unit checks for providers/jooble.mjs response mapping
// against a hardcoded sample of the documented Jooble API response shape,
// plus the missing-key → { skip: true } contract. Plain node script:
//   node test/jooble.test.mjs
// Exits 1 on any failure; prints a PASS/FAIL summary. No network access.

import jooble, { mapJoobleResponse, stripTracking, stripHtml } from '../providers/jooble.mjs';

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) { pass++; }
  else { fail++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); }
}

// ── Hardcoded sample API response (documented shape, jooble.org/api/about) ──
const SAMPLE = {
  totalCount: 4187,
  jobs: [
    {
      title: 'Software <b>Engineer</b> (Junior)',
      location: 'København',
      snippet: 'We are looking for a&nbsp;<b>engineer</b> to join our team in Copenhagen.&hellip; Knowledge of AWS &amp; CI/CD required. '
        + 'x'.repeat(300),
      salary: '',
      source: 'jobindex.dk',
      type: 'Full-time',
      link: 'https://jooble.org/desc/4719284736152839476?ckey=engineer&rgn=12&pos=3&elckey=abc123',
      company: 'Acme A/S',
      updated: '2026-06-10T00:00:00.0000000',
      id: 4719284736152839476,
    },
    {
      title: 'Data Analyst',
      location: 'København, Danmark',
      snippet: '<b>Analyst</b> role &#8211; SQL &#x26; Excel.',
      salary: '1.200 EUR',
      source: 'thehub.io',
      type: '',
      link: 'https://jooble.org/desc/111?ckey=analyst',
      company: 'Danske Bank',
      updated: '2026-06-09T14:30:00.0000000',
      id: 111,
    },
    // No link → must be dropped.
    { title: 'Ghost Job', location: 'København', snippet: '', link: '', company: 'X', updated: '' },
    // No title → must be dropped.
    { title: '  ', location: 'København', snippet: 's', link: 'https://jooble.org/desc/222', company: 'Y', updated: '' },
  ],
};

// ── stripTracking ───────────────────────────────────────────────────
check('stripTracking: drops ?ckey tracking query',
  stripTracking('https://jooble.org/desc/123?ckey=engineer&rgn=12&pos=3') === 'https://jooble.org/desc/123',
  `got "${stripTracking('https://jooble.org/desc/123?ckey=engineer&rgn=12&pos=3')}"`);
check('stripTracking: drops fragment + trailing slash',
  stripTracking('https://jooble.org/desc/123/#top') === 'https://jooble.org/desc/123',
  `got "${stripTracking('https://jooble.org/desc/123/#top')}"`);
check('stripTracking: non-URL input falls back to ?-split',
  stripTracking('desc/123?x=1') === 'desc/123', `got "${stripTracking('desc/123?x=1')}"`);

// ── stripHtml ───────────────────────────────────────────────────────
// Tags become a space (so "Line1<br>Line2" never glues words), then ws collapses.
check('stripHtml: removes <b> tags, decodes &nbsp;/&amp;/&hellip;, collapses ws',
  stripHtml('a&nbsp;<b>bold</b>&hellip; x &amp; y') === 'a bold … x & y',
  `got "${stripHtml('a&nbsp;<b>bold</b>&hellip; x &amp; y')}"`);
check('stripHtml: <br> separates words', stripHtml('Line1<br>Line2') === 'Line1 Line2',
  `got "${stripHtml('Line1<br>Line2')}"`);
check('stripHtml: numeric entities (dec + hex)',
  stripHtml('A &#8211; B &#x26; C') === 'A – B & C', `got "${stripHtml('A &#8211; B &#x26; C')}"`);
check('stripHtml: empty/nullish → ""', stripHtml(null) === '' && stripHtml('') === '');

// ── mapJoobleResponse ───────────────────────────────────────────────
const jobs = mapJoobleResponse(SAMPLE);
check('map: drops items without link/title (2 of 4 kept)', jobs.length === 2, `got ${jobs.length}`);

const j1 = jobs[0] || {};
check('map: link → url with tracking stripped',
  j1.url === 'https://jooble.org/desc/4719284736152839476', `got "${j1.url}"`);
check('map: title HTML-stripped',
  j1.title === 'Software Engineer (Junior)', `got "${j1.title}"`);
check('map: company passed through', j1.company === 'Acme A/S', `got "${j1.company}"`);
check('map: location passed through', j1.location === 'København', `got "${j1.location}"`);
check('map: updated → posted ISO date', j1.posted === '2026-06-10', `got "${j1.posted}"`);
check('map: snippet HTML-stripped', (j1.snippet || '').startsWith('We are looking for a engineer to join our team in Copenhagen.… Knowledge of AWS & CI/CD required.'),
  `got "${(j1.snippet || '').slice(0, 110)}"`);
check('map: snippet capped at 200 chars', (j1.snippet || '').length <= 200, `got ${j1.snippet?.length}`);

const j2 = jobs[1] || {};
check('map: second item posted ISO date', j2.posted === '2026-06-09', `got "${j2.posted}"`);
check('map: second item snippet entities decoded', j2.snippet === 'Analyst role – SQL & Excel.', `got "${j2.snippet}"`);

check('map: tolerates missing jobs array', Array.isArray(mapJoobleResponse({})) && mapJoobleResponse({}).length === 0);
check('map: tolerates null response', Array.isArray(mapJoobleResponse(null)) && mapJoobleResponse(null).length === 0);

// ── merge+dedupe by link across keyword queries (same link, different ckey) ──
const dupA = mapJoobleResponse({ jobs: [{ ...SAMPLE.jobs[0], link: 'https://jooble.org/desc/999?ckey=engineer' }] });
const dupB = mapJoobleResponse({ jobs: [{ ...SAMPLE.jobs[0], link: 'https://jooble.org/desc/999?ckey=analyst' }] });
check('dedupe: same ad from two keyword queries → identical canonical url',
  dupA[0].url === dupB[0].url && dupA[0].url === 'https://jooble.org/desc/999',
  `got "${dupA[0]?.url}" vs "${dupB[0]?.url}"`);

// ── Missing key → { skip: true } (NOT a plain failure) ──────────────
{
  const saved = process.env.JOOBLE_API_KEY;
  delete process.env.JOOBLE_API_KEY;
  let thrown = null;
  try {
    await jooble.fetch({ url: 'https://jooble.org/api/', location: 'København' }, {});
  } catch (err) {
    thrown = err;
  }
  if (saved !== undefined) process.env.JOOBLE_API_KEY = saved;
  check('fetch: missing JOOBLE_API_KEY throws', thrown !== null);
  check('fetch: missing-key error carries skip:true (→ status "skipped")',
    thrown?.skip === true, `got skip=${thrown?.skip}, softFail=${thrown?.softFail}`);
  check('fetch: missing-key error names the variable',
    /JOOBLE_API_KEY/.test(thrown?.message || ''), `got "${thrown?.message}"`);
}

// ── fetch() with stubbed HTTP: keyword loop, merge+dedupe, partial failure ──
{
  const saved = process.env.JOOBLE_API_KEY;
  process.env.JOOBLE_API_KEY = 'test-key-123';
  const requests = [];
  const ad = (id, ckey, extra = {}) => ({
    title: `Job ${id}`, location: 'København', snippet: 's', salary: '', source: '',
    type: '', link: `https://jooble.org/desc/${id}?ckey=${ckey}`, company: 'C',
    updated: '2026-06-10T00:00:00.0000000', id, ...extra,
  });
  const fakeHelpers = {
    http: {
      fetchWithRetry: async (url, opts) => {
        const body = JSON.parse(opts.body);
        requests.push({ url, keywords: body.keywords, location: body.location });
        if (body.keywords === 'analyst') {
          throw Object.assign(new Error('HTTP 500'), { status: 500 }); // partial failure
        }
        // '' returns ads 1+2; 'engineer' returns ad 2 again (different ckey) + ad 3.
        const jobs = body.keywords === '' ? [ad(1, 'all'), ad(2, 'all')] : [ad(2, body.keywords), ad(3, body.keywords)];
        return { json: async () => ({ totalCount: jobs.length, jobs }) };
      },
    },
    politeDelay: async () => {},
    requestDelayMs: 0,
    deadline: Date.now() + 60_000,
  };
  const fetched = await jooble.fetch({ url: 'https://jooble.org/api/', location: 'København' }, fakeHelpers);
  if (saved !== undefined) process.env.JOOBLE_API_KEY = saved; else delete process.env.JOOBLE_API_KEY;

  check('fetch: one POST per default keyword (4)', requests.length === 4, `got ${requests.length}`);
  check('fetch: key embedded in POST url', requests.every((r) => r.url === 'https://jooble.org/api/test-key-123'),
    `got "${requests[0]?.url}"`);
  check('fetch: keywords sent in order', JSON.stringify(requests.map((r) => r.keywords)) === JSON.stringify(['', 'engineer', 'analyst', 'administrator']),
    `got ${JSON.stringify(requests.map((r) => r.keywords))}`);
  check('fetch: location København in every body', requests.every((r) => r.location === 'København'));
  check('fetch: merged + deduped by canonical link (3 unique of 6 returned)',
    fetched.length === 3 && new Set(fetched.map((j) => j.url)).size === 3,
    `got ${fetched.length}: ${fetched.map((j) => j.url).join(', ')}`);
  check('fetch: partial keyword failure still returns results', fetched.some((j) => j.url.endsWith('/3')));
}

// ── detect() fallback ───────────────────────────────────────────────
check('detect: claims jooble.org urls', !!jooble.detect({ url: 'https://jooble.org/api/' }));
check('detect: ignores other urls', !jooble.detect({ url: 'https://example.com/' }));

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${pass + fail} checks: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('ALL PASS');
