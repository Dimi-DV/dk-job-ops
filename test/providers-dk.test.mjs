#!/usr/bin/env node
// test/providers-dk.test.mjs — unit checks for the Danish providers' pure
// mapping/parsing functions against hardcoded samples. No network access.
//   node test/providers-dk.test.mjs
// Exits 1 on any failure. NOTE: these assert the mapping logic against the
// ASSUMED live shapes (see each provider's VERIFY-AT-BUILD header). If the real
// jobnet/thehub/jobindex payloads differ, update the samples AND the providers.

import * as cheerio from 'cheerio/slim';
import { mapJobnetResponse, canonicalJobnetUrl } from '../providers/jobnet.mjs';
import { mapAlgoliaHits } from '../providers/thehub.mjs';
import { parseListingPage } from '../providers/jobindex.mjs';

let pass = 0, fail = 0;
const failures = [];
function check(label, ok, detail = '') {
  if (ok) pass++;
  else { fail++; failures.push(`${label}${detail ? ` — ${detail}` : ''}`); }
}

// ── Jobnet (assumed JobPositionPostings shape) ──────────────────────────
const JOBNET_SAMPLE = {
  TotalResultCount: 2,
  JobPositionPostings: [
    {
      ID: 5512345,
      Title: 'Cloud Engineer',
      HiringOrgName: 'Acme A/S',
      WorkPlaceCity: 'København',
      WorkPlacePostalCode: '2100',
      PostingCreated: '2026-06-20T08:00:00',
      JobDescription: '<p>Vi søger en <b>cloud engineer</b>.</p>',
    },
    { Title: '', HiringOrgName: 'No Title ApS' }, // dropped: no title (and no id/url)
  ],
};
{
  const jobs = mapJobnetResponse(JOBNET_SAMPLE);
  check('jobnet: drops the title-less row', jobs.length === 1, `got ${jobs.length}`);
  const j = jobs[0];
  check('jobnet: canonical path-id url', j?.url === 'https://job.jobnet.dk/CV/FindWork/Job/5512345', j?.url);
  check('jobnet: title', j?.title === 'Cloud Engineer', j?.title);
  check('jobnet: company', j?.company === 'Acme A/S', j?.company);
  check('jobnet: location joins city + zip', j?.location === 'København, 2100', j?.location);
  check('jobnet: posted ISO from datetime', j?.posted === '2026-06-20', j?.posted);
  check('jobnet: snippet stripped of HTML', j?.snippet.startsWith('Vi søger en cloud engineer') && !/[<>]/.test(j?.snippet ?? '<'), j?.snippet);
  check('jobnet: empty/garbage response → []', mapJobnetResponse({}).length === 0);
  check('jobnet: canonicalJobnetUrl falls back to DetailsUrl path',
    canonicalJobnetUrl({ DetailsUrl: 'https://job.jobnet.dk/CV/Job/9?x=1#frag' }) === 'https://job.jobnet.dk/CV/Job/9');
}

// ── TheHub (assumed Algolia hit shape) ──────────────────────────────────
const HUB_SAMPLE = {
  nbPages: 1,
  hits: [
    {
      objectID: 'abc',
      slug: 'acme-backend-developer',
      title: 'Backend Developer',
      companyName: 'Acme',
      location: 'Copenhagen',
      createdAt: 1750000000, // epoch seconds
      description: '<p>Join <b>us</b>.</p>',
    },
    { objectID: 'no-title', slug: 'x' }, // dropped: no title
  ],
};
{
  const jobs = mapAlgoliaHits(HUB_SAMPLE);
  check('thehub: drops the title-less hit', jobs.length === 1, `got ${jobs.length}`);
  const j = jobs[0];
  check('thehub: url from slug', j?.url === 'https://thehub.io/jobs/acme-backend-developer', j?.url);
  check('thehub: title', j?.title === 'Backend Developer', j?.title);
  check('thehub: company', j?.company === 'Acme', j?.company);
  check('thehub: posted from epoch seconds', j?.posted === '2025-06-15', j?.posted);
  check('thehub: snippet stripped', j?.snippet.startsWith('Join us') && !/[<>]/.test(j?.snippet ?? '<'), j?.snippet);
  check('thehub: empty response → []', mapAlgoliaHits({}).length === 0);
}

// ── Jobindex (assumed listing HTML) ─────────────────────────────────────
const JOBINDEX_HTML = `
<div class="jobsearch-result">
  <h4><a href="/vis-job/12345/cloud-engineer">Cloud Engineer</a></h4>
  <div class="jix_robotjob--company">Acme A/S</div>
  <div class="jix_robotjob--area">København</div>
  <time datetime="20-06-2026">20-06-2026</time>
  <p class="jobsearch-result__teaser">Vi søger en cloud engineer til vores team.</p>
</div>
<div class="jix_robotjob">
  <a href="/vis-job/67890/data-analyst"><b>Data Analyst</b></a>
  <div class="jix_robotjob--company">DataCo</div>
  <div class="jix_robotjob--area">Aarhus</div>
</div>
<div class="jobsearch-result"><span>no link here — dropped</span></div>
`;
{
  const $ = cheerio.load(JOBINDEX_HTML);
  const stubHelpers = { html: { toIsoDate: (s) => (s === '20-06-2026' ? '2026-06-20' : '') } };
  const jobs = parseListingPage($, 'https://www.jobindex.dk', stubHelpers);
  check('jobindex: parses 2 valid cards, drops link-less', jobs.length === 2, `got ${jobs.length}`);
  const a = jobs.find((j) => /12345/.test(j.url));
  check('jobindex: canonical path url', a?.url === 'https://www.jobindex.dk/vis-job/12345/cloud-engineer', a?.url);
  check('jobindex: title', a?.title === 'Cloud Engineer', a?.title);
  check('jobindex: company', a?.company === 'Acme A/S', a?.company);
  check('jobindex: location', a?.location === 'København', a?.location);
  check('jobindex: posted parsed via helper', a?.posted === '2026-06-20', a?.posted);
}

// ── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.error('\nFAILURES:\n  ' + failures.join('\n  ')); process.exit(1); }
