#!/usr/bin/env node

/**
 * scan.mjs — dk-job-ops zero-token portal scanner (Denmark job search).
 * Ported from career-ops scan.mjs: provider plugin loader, parallelFetch pool,
 * location-filter semantics (always_allow > block > allow), scan-history dedup.
 * New here: classify() negative-first title/company filtering on diacritic-
 * normalized text, posted/snippet fields, two-key dedup, budget deadline,
 * --seed baseline crawls, per-run provider status JSON.
 *
 * Zero Claude API tokens — pure HTTP + cheerio.
 *
 * Usage:
 *   node scan.mjs                       # daily scan of all enabled targets
 *   node scan.mjs --dry-run             # no writes; summary + sample rows + drop counters
 *   node scan.mjs --seed                # deep baseline crawl (seed_page_cap, status=seeded, no data/new files)
 *   node scan.mjs --budget=420          # global deadline in seconds (default 420)
 *   node scan.mjs --source jobnet       # only targets whose name contains "jobnet"
 *
 * ════════════════════════════════════════════════════════════════════════
 * PROVIDER CONTRACT — read this before writing a new provider
 * ════════════════════════════════════════════════════════════════════════
 * A provider is a file `providers/<id>.mjs` (files starting with `_` are
 * shared helpers, never loaded as providers). Default export:
 *
 *   export default {
 *     id: 'jobnet',              // REQUIRED — matched against `provider:` in portals.yml
 *     detect(entry) {…},         // OPTIONAL — return truthy ({url}) to claim an entry
 *                                //   that has NO explicit `provider:` field (fallback only;
 *                                //   dk-job-ops entries always set provider: explicitly)
 *     async fetch(entry, helpers) {…},  // REQUIRED — resolves to Job[]
 *   };
 *
 * `entry` is the raw portals.yml object (boards or companies item) — read your
 * own extra fields from it (url, rss, location, workday:{}, api, …).
 *
 * Job = {
 *   url:      string,  // REQUIRED — canonical ad URL
 *   title:    string,  // REQUIRED
 *   company:  string,  // '' allowed when a board hides the employer
 *   location: string,  // '' allowed
 *   source?:  string,  // defaults to the provider id
 *   posted?:  string,  // ISO 'YYYY-MM-DD' or '' — use helpers.html.toIsoDate(...)
 *   snippet?: string,  // plain text; scan.mjs truncates to 200 chars
 * }
 *
 * helpers = {
 *   // career-ops back-compat (the copied ATS providers call these directly):
 *   transport: 'http', fetchJson(url, opts), fetchText(url, opts),
 *   // namespaced + retry variants for new providers:
 *   http:  { fetchJson, fetchText, fetchWithRetry },
 *   html:  { loadHtml, loadRss, toIsoDate, rssDateToIso, relativeToIso },
 *   seenUrls: Set<string>,     // normalized URLs already known (history + this run).
 *                              //   PAGINATION RULE: if EVERY ad on a fetched page is
 *                              //   already in seenUrls, stop fetching further pages.
 *   normalizeUrl(url),         // apply before checking seenUrls
 *   pageCap: number,           // max listing pages this run (daily_page_cap | seed_page_cap)
 *   requestDelayMs: number,    // base inter-page delay for this host
 *   politeDelay(ms),           // jittered sleep — call between paginated requests:
 *                              //   await helpers.politeDelay(helpers.requestDelayMs)
 *   deadline: number,          // epoch ms — stop paginating early if Date.now() >= deadline
 * }
 *
 * Error signalling from fetch():
 *   throw Object.assign(new Error('429 …'), { softFail: true })  → status 'soft_fail'
 *       (expected intermittent failure, e.g. LinkedIn guest API rate limit)
 *   throw Object.assign(new Error('JOOBLE_API_KEY not set'), { skip: true }) → 'skipped'
 *   any other throw → status 'failed'
 *
 * Division of labor: providers return RAW jobs — scan.mjs owns title/company
 * classification, the location filter, dedup, truncation, and all file writes.
 * Providers run in parallel (6 at a time, one task per target); pagination
 * INSIDE a provider must be sequential with politeDelay between pages.
 * ════════════════════════════════════════════════════════════════════════
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';
import yaml from 'js-yaml';

import { makeHttpCtx, fetchJson, fetchText, fetchWithRetry, politeDelay } from './providers/_http.mjs';
import * as htmlHelpers from './providers/_html.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORTALS_PATH = path.join(ROOT, 'portals.yml');
const DATA_DIR = path.join(ROOT, 'data');
const SCAN_HISTORY_PATH = path.join(DATA_DIR, 'scan-history.tsv');
const NEW_DIR = path.join(DATA_DIR, 'new');
const PROVIDERS_DIR = path.join(ROOT, 'providers');

const CONCURRENCY = 6;
const DEFAULT_BUDGET_SEC = 420;
const SNIPPET_MAX = 400; // bumped 200→400 (2026-06-17): room for the enriched
// snippet — seniority/employment + a JD excerpt now captured by linkedin/ashby/
// greenhouse providers so Tier-1 sees hidden-seniority/stack and diverges less from Tier-2.
const HISTORY_HEADER = 'url\tfirst_seen\tsource\ttitle\tcompany\tstatus\tlocation\tposted\tflags';
const NEW_TSV_HEADER = 'url\tsource\tcompany\ttitle\tlocation\tposted\tflags\tsnippet';

// ── Normalization ───────────────────────────────────────────────────
// Diacritic-fold so rengøring ≡ rengoring and København ≡ kobenhavn.
// æ/ø have NO NFD decomposition (they are base letters), so transliterate
// them first — æ→ae, ø→o — mirroring the legacy đ→dj. å DOES decompose
// (a + combining ring) and is stripped by the \p{M} pass below → a.
// CONSEQUENCE: every Danish token in portals.yml (filters, location_filter)
// must be written in this folded space — "kobenhavn", "aarhus", "danmark".
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/đ/g, 'dj')   // legacy Serbian đ (harmless; defensive)
    .replace(/ø/g, 'o')    // Danish ø — no NFD decomposition
    .replace(/æ/g, 'ae')   // Danish æ — no NFD decomposition
    .normalize('NFD')
    .replace(/\p{M}/gu, ''); // å → a + combining ring → a
}

// ── classify() — negative-first title/company filter ───────────────
// Order: company exclude → title exclude → title flag (keep but tag).
// Returns { action:'keep'|'drop', reason?, flags:[] }.
// reason is 'company:<token>' | 'title:<token>' — fed into per-reason counters.

export function prepareFilters(filtersCfg = {}) {
  const norm = (list) => (Array.isArray(list) ? list : [])
    .filter((t) => typeof t === 'string')
    .map((t) => normalize(t).trim())
    .filter(Boolean);
  return {
    companyExclude: norm(filtersCfg.company?.exclude),
    titleExclude: norm(filtersCfg.title?.exclude),
    titleFlag: norm(filtersCfg.title?.flag),
  };
}

export function classify(job, filters) {
  const title = normalize(job?.title);
  const company = normalize(job?.company);
  if (company) {
    for (const tok of filters.companyExclude) {
      if (company.includes(tok)) return { action: 'drop', reason: `company:${tok}`, flags: [] };
    }
  }
  for (const tok of filters.titleExclude) {
    if (title.includes(tok)) return { action: 'drop', reason: `title:${tok}`, flags: [] };
  }
  const flags = filters.titleFlag.filter((tok) => title.includes(tok));
  return { action: 'keep', flags };
}

// ── Location filter (career-ops semantics, diacritic-normalized) ────
//   empty/non-string location → pass
//   always_allow match → pass (beats block: "Remote EMEA incl. Denmark" passes)
//   block match → reject
//   allow empty → pass; allow non-empty → must match one keyword

function normalizeKeywordList(value) {
  if (value == null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .filter((k) => typeof k === 'string')
    .map((k) => normalize(k).trim())
    .filter(Boolean);
}

export function buildLocationFilter(locationFilter) {
  if (!locationFilter) return () => true;
  const alwaysAllow = normalizeKeywordList(locationFilter.always_allow);
  const allow = normalizeKeywordList(locationFilter.allow);
  const block = normalizeKeywordList(locationFilter.block);

  return (location) => {
    if (typeof location !== 'string' || location.trim() === '') return true;
    const lower = normalize(location);
    if (alwaysAllow.length > 0 && alwaysAllow.some((k) => lower.includes(k))) return true;
    if (block.length > 0 && block.some((k) => lower.includes(k))) return false;
    if (allow.length === 0) return true;
    return allow.some((k) => lower.includes(k));
  };
}

// ── Dedup keys ──────────────────────────────────────────────────────
// Key 1: normalized URL. Board ad URLs (jobindex / jobnet / thehub / LinkedIn
// /jobs/view) carry tracking query params + fragments — strip them. ATS URLs
// are kept byte-for-byte (their paths/queries can be meaningful).
// NOTE: query-stripping is only safe when the ad identity lives in the PATH —
// jobnet → /CV/FindWork/Job/{id}, thehub → /jobs/{slug} are path-id (safe).
// The jobindex provider canonicalizes to a path-id URL; if any board ever puts
// the id in the query string, drop it from this list (else false dedup).
export function normalizeUrl(url) {
  const raw = String(url ?? '').trim();
  let u;
  try { u = new URL(raw); } catch { return raw; }
  const host = u.hostname.toLowerCase();
  const stripQuery =
    (/(^|\.)linkedin\.com$/.test(host) && u.pathname.startsWith('/jobs/view')) ||
    /(^|\.)jobindex\.dk$/.test(host) ||
    /(^|\.)jobnet\.dk$/.test(host) ||
    /(^|\.)thehub\.io$/.test(host);
  if (stripQuery) return `${u.protocol}//${host}${u.pathname.replace(/\/+$/, '')}`;
  return raw;
}

// Key 2: cross-board company::title (collapses the same bank vacancy seen on
// Jobindex + Jooble + LinkedIn). Only used when both halves are non-empty.
export function crossKey(company, title) {
  const c = normalize(company).trim();
  const t = normalize(title).trim();
  if (!c || !t) return null;
  return `${c}::${t}`;
}

// Seed both dedup sets from data/scan-history.tsv
// (cols: url, first_seen, source, title, company, status, location, posted, flags).
function loadHistory() {
  const seenUrls = new Set();
  const seenKeys = new Set();
  if (existsSync(SCAN_HISTORY_PATH)) {
    const lines = readFileSync(SCAN_HISTORY_PATH, 'utf-8').split('\n');
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.split('\t');
      const url = cols[0];
      if (url) seenUrls.add(normalizeUrl(url));
      const key = crossKey(cols[4], cols[3]);
      if (key) seenKeys.add(key);
    }
  }
  return { seenUrls, seenKeys };
}

// ── Provider loading (career-ops pattern) ───────────────────────────

async function loadProviders(dir) {
  const providers = new Map();
  if (!existsSync(dir)) return providers;
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
    .sort(); // alphabetical → deterministic detect() priority
  for (const file of entries) {
    let mod;
    try {
      mod = await import(pathToFileURL(path.join(dir, file)).href);
    } catch (err) {
      console.error(`⚠️  ${file}: failed to load — ${err.message}`);
      continue;
    }
    const p = mod.default;
    if (!p || typeof p.fetch !== 'function' || !p.id) {
      console.error(`⚠️  ${file}: skipping — default export must be { id, fetch }`);
      continue;
    }
    if (providers.has(p.id)) {
      console.error(`⚠️  ${file}: duplicate provider id "${p.id}" — keeping first`);
      continue;
    }
    providers.set(p.id, p);
  }
  return providers;
}

// Explicit `provider:` wins; detect() is a fallback for entries without one.
function resolveProvider(entry, providers) {
  if (entry.provider) {
    const p = providers.get(entry.provider);
    if (!p) return { entry, resolveError: `provider "${entry.provider}" not installed` };
    return { entry, provider: p };
  }
  for (const p of providers.values()) {
    try {
      if (p.detect?.(entry)) return { entry, provider: p };
    } catch (err) {
      console.error(`⚠️  ${p.id}: detect() threw for "${entry.name}" — ${err.message}`);
    }
  }
  return { entry, resolveError: 'no provider matched (set provider: explicitly)' };
}

// ── Writers ─────────────────────────────────────────────────────────

// TSV fields must never contain tabs/newlines.
function clean(s) {
  return String(s ?? '').replace(/[\t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

function appendHistory(jobs, date, status) {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SCAN_HISTORY_PATH)) {
    writeFileSync(SCAN_HISTORY_PATH, HISTORY_HEADER + '\n', 'utf-8');
  }
  const lines = jobs.map((j) => [
    clean(j.url), date, clean(j.source), clean(j.title), clean(j.company),
    status, clean(j.location), clean(j.posted), clean(j.flags.join(',')),
  ].join('\t')).join('\n') + '\n';
  appendFileSync(SCAN_HISTORY_PATH, lines, 'utf-8');
}

function writeNewFiles(jobs, date, providerResults, totals) {
  mkdirSync(NEW_DIR, { recursive: true });
  const tsv = [
    NEW_TSV_HEADER,
    ...jobs.map((j) => [
      clean(j.url), clean(j.source), clean(j.company), clean(j.title),
      clean(j.location), clean(j.posted), clean(j.flags.join(',')), clean(j.snippet),
    ].join('\t')),
  ].join('\n') + '\n';
  const tsvPath = path.join(NEW_DIR, `${date}.tsv`);
  writeFileSync(tsvPath, tsv, 'utf-8');
  const jsonPath = path.join(NEW_DIR, `${date}.providers.json`);
  writeFileSync(jsonPath, JSON.stringify({ date, providers: providerResults, totals }, null, 2) + '\n', 'utf-8');
  return { tsvPath, jsonPath };
}

// Fisher–Yates partial shuffle → n random rows (dry-run sampling only).
function randomSample(arr, n) {
  const a = arr.slice();
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// ── Parallel fetch with concurrency limit ───────────────────────────

async function parallelFetch(tasks, limit) {
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      await task();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
}

// ── CLI ─────────────────────────────────────────────────────────────

function usage() {
  console.log(`Usage: node scan.mjs [options]

Options:
  --dry-run         Preview only — no files written; prints sample kept rows + drop counters
  --sample=N        Size of the random kept-row sample printed on --dry-run (default 15)
  --show-dropped[=N]  On --dry-run, also print a random sample of N dropped rows
                    per drop category (title/company/location; default 20 each)
  --seed            Deep baseline crawl: seed_page_cap pages, history rows status=seeded,
                    NO data/new/ files are written
  --budget=N        Global deadline in seconds (default ${DEFAULT_BUDGET_SEC}). Providers not yet
                    started at the deadline are recorded skipped_budget; partial results
                    are still written. Exit code 0 unless ALL attempted providers failed.
  --source NAME     Only scan boards/companies whose name contains NAME (case-insensitive)
  --help, -h        This help

Outputs (non-seed, non-dry runs):
  data/scan-history.tsv            append-only dedup ledger (status=new|seeded)
  data/new/YYYY-MM-DD.tsv          today's new rows → triage handoff
  data/new/YYYY-MM-DD.providers.json  per-provider run status + totals`);
}

function parseArgs(argv) {
  const args = { seed: false, dryRun: false, budgetSec: DEFAULT_BUDGET_SEC, source: null, help: false, sample: 15, showDropped: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a.startsWith('--sample=')) {
      const n = Number(a.split('=')[1]);
      if (!Number.isFinite(n) || n <= 0) { console.error(`Invalid --sample value: ${a}`); process.exit(1); }
      args.sample = Math.floor(n);
    } else if (a === '--show-dropped' || a.startsWith('--show-dropped=')) {
      const n = a.includes('=') ? Number(a.split('=')[1]) : 20;
      if (!Number.isFinite(n) || n <= 0) { console.error(`Invalid --show-dropped value: ${a}`); process.exit(1); }
      args.showDropped = Math.floor(n);
    }
    else if (a === '--budget' || a.startsWith('--budget=')) {
      const val = a.includes('=') ? a.split('=')[1] : argv[++i];
      const n = Number(val);
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`Invalid --budget value: ${val ?? '(missing)'}`);
        process.exit(1);
      }
      args.budgetSec = n;
    } else if (a === '--source' || a.startsWith('--source=')) {
      const val = a.includes('=') ? a.slice('--source='.length) : argv[++i];
      if (!val) {
        console.error('--source requires a name');
        process.exit(1);
      }
      args.source = val.toLowerCase();
    } else {
      console.error(`Unknown flag: ${a} (try --help)`);
      process.exit(1);
    }
  }
  return args;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  if (!existsSync(PORTALS_PATH)) {
    console.error(`Error: portals.yml not found at ${PORTALS_PATH}`);
    process.exit(1);
  }
  const config = yaml.load(readFileSync(PORTALS_PATH, 'utf-8')) || {};
  const defaults = config.defaults || {};
  const pageCap = args.seed ? (defaults.seed_page_cap ?? 80) : (defaults.daily_page_cap ?? 8);
  const requestDelayMs = defaults.request_delay_ms ?? 500;
  const filters = prepareFilters(config.filters);
  const locationOk = buildLocationFilter(config.location_filter);

  // Targets = boards + companies, one flat list.
  const boards = Array.isArray(config.boards) ? config.boards : [];
  const companies = Array.isArray(config.companies) ? config.companies : [];
  const targets = [];
  for (const entry of [...boards, ...companies]) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.enabled === false) continue;
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      console.error(`⚠️  Skipping entry — missing 'name': ${JSON.stringify(entry)}`);
      continue;
    }
    if (args.source && !entry.name.toLowerCase().includes(args.source)) continue;
    targets.push(entry);
  }
  if (targets.length === 0) {
    console.log(`0 targets matched${args.source ? ` --source "${args.source}"` : ' (nothing enabled in portals.yml)'}.`);
    return;
  }

  const providers = await loadProviders(PROVIDERS_DIR);
  if (providers.size === 0) {
    console.error('Error: no providers loaded from providers/');
    process.exit(1);
  }
  const resolved = targets.map((entry) => resolveProvider(entry, providers));

  const { seenUrls, seenKeys } = loadHistory();

  const date = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + args.budgetSec * 1000;
  const mode = args.seed ? 'seed' : 'daily';
  console.log(`Scanning ${targets.length} target(s) — mode=${mode}, page cap ${pageCap}, budget ${args.budgetSec}s`);
  if (args.dryRun) console.log('(dry run — no files will be written)');

  const counters = { found: 0, dropped_title: 0, dropped_company: 0, dropped_location: 0, dupes: 0, invalid: 0 };
  const dropReasons = new Map(); // 'title:vozac' → count
  const droppedRows = args.dryRun && args.showDropped > 0
    ? { title: [], company: [], location: [] } : null; // dry-run inspection only
  const newJobs = [];
  const providerResults = new Array(resolved.length); // portals.yml order, deterministic

  const tasks = resolved.map((target, idx) => async () => {
    const { entry, provider, resolveError } = target;
    if (resolveError) {
      providerResults[idx] = { name: entry.name, status: 'skipped', jobs: 0, error: resolveError };
      return;
    }
    if (Date.now() >= deadline) {
      providerResults[idx] = { name: entry.name, status: 'skipped_budget', jobs: 0 };
      return;
    }
    const helpers = {
      ...makeHttpCtx(),
      http: { fetchJson, fetchText, fetchWithRetry },
      html: htmlHelpers,
      seenUrls,
      normalizeUrl,
      pageCap: entry.page_cap ?? pageCap,
      requestDelayMs: entry.request_delay_ms ?? requestDelayMs,
      politeDelay,
      deadline,
    };

    let jobs;
    try {
      jobs = await provider.fetch(entry, helpers);
      if (!Array.isArray(jobs)) throw new Error(`${provider.id}: fetch() did not return an array`);
    } catch (err) {
      const status = err?.skip ? 'skipped' : err?.softFail ? 'soft_fail' : 'failed';
      providerResults[idx] = { name: entry.name, status, jobs: 0, error: err.message };
      return;
    }

    let kept = 0;
    for (const raw of jobs) {
      counters.found++;
      const job = {
        url: typeof raw?.url === 'string' ? raw.url.trim() : '',
        title: clean(raw?.title),
        company: clean(raw?.company),
        location: clean(raw?.location),
        source: clean(raw?.source) || provider.id,
        posted: clean(raw?.posted),
        snippet: clean(raw?.snippet).slice(0, SNIPPET_MAX),
      };
      if (!job.url || !job.title) { counters.invalid++; continue; }

      const verdict = classify(job, filters);
      if (verdict.action === 'drop') {
        dropReasons.set(verdict.reason, (dropReasons.get(verdict.reason) || 0) + 1);
        if (verdict.reason.startsWith('company:')) counters.dropped_company++;
        else counters.dropped_title++;
        droppedRows?.[verdict.reason.startsWith('company:') ? 'company' : 'title']
          ?.push({ ...job, reason: verdict.reason });
        continue;
      }
      if (!locationOk(job.location)) {
        counters.dropped_location++;
        droppedRows?.location?.push({ ...job, reason: `location:${job.location}` });
        continue;
      }

      const urlKey = normalizeUrl(job.url);
      if (seenUrls.has(urlKey)) { counters.dupes++; continue; }
      const key = crossKey(job.company, job.title);
      if (key && seenKeys.has(key)) { counters.dupes++; continue; }
      seenUrls.add(urlKey); // also blocks intra-run dupes across providers
      if (key) seenKeys.add(key);

      newJobs.push({ ...job, flags: verdict.flags });
      kept++;
    }
    providerResults[idx] = { name: entry.name, status: 'ok', jobs: kept };
  });

  await parallelFetch(tasks, CONCURRENCY);

  const totals = {
    found: counters.found,
    dropped_title: counters.dropped_title,
    dropped_company: counters.dropped_company,
    dropped_location: counters.dropped_location,
    dupes: counters.dupes,
    new: newJobs.length,
  };

  // ── Write (partial results count — budget overruns still land here) ──
  let written = null;
  if (!args.dryRun) {
    if (newJobs.length > 0) appendHistory(newJobs, date, args.seed ? 'seeded' : 'new');
    if (!args.seed) written = writeNewFiles(newJobs, date, providerResults, totals);
  }

  // ── Summary ──
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`DK-Job-Ops Scan — ${date} (${mode}${args.dryRun ? ', dry run' : ''})`);
  console.log('━'.repeat(50));
  console.log(`Targets scanned:        ${targets.length}`);
  console.log(`Jobs found:             ${totals.found}`);
  console.log(`Dropped by title:       ${totals.dropped_title}`);
  console.log(`Dropped by company:     ${totals.dropped_company}`);
  console.log(`Dropped by location:    ${totals.dropped_location}`);
  if (counters.invalid > 0) console.log(`Invalid (no url/title): ${counters.invalid}`);
  console.log(`Duplicates:             ${totals.dupes}`);
  console.log(`New:                    ${totals.new}`);

  console.log('\nProviders:');
  for (const r of providerResults) {
    if (!r) continue;
    const icon = r.status === 'ok' ? '✓' : r.status === 'failed' ? '✗' : '~';
    console.log(`  ${icon} ${r.name.padEnd(24)} ${r.status.padEnd(15)} ${r.status === 'ok' ? `${r.jobs} new` : (r.error || '')}`);
  }

  if (dropReasons.size > 0) {
    const sorted = [...dropReasons.entries()].sort((a, b) => b[1] - a[1]);
    const shown = args.dryRun ? sorted : sorted.slice(0, 10);
    console.log(`\nDrop reasons${args.dryRun ? '' : ' (top 10)'}:`);
    for (const [reason, count] of shown) console.log(`  ${String(count).padStart(5)}  ${reason}`);
  }

  if (args.dryRun && newJobs.length > 0) {
    const keptSample = randomSample(newJobs, args.sample);
    console.log(`\nSample kept rows (random ${keptSample.length} of ${newJobs.length}):`);
    for (const j of keptSample) {
      const flagStr = j.flags.length ? ` [${j.flags.join(',')}]` : '';
      console.log(`  + ${j.company || '(no company)'} | ${j.title} | ${j.location || 'N/A'} | ${j.posted || 'no date'}${flagStr}  ${j.url}`);
    }
    if (droppedRows) {
      for (const [cat, rows] of Object.entries(droppedRows)) {
        if (rows.length === 0) continue;
        const sample = randomSample(rows, args.showDropped);
        console.log(`\nSample DROPPED rows — ${cat} (random ${sample.length} of ${rows.length}):`);
        for (const j of sample) {
          console.log(`  - [${j.reason}] ${j.company || '(no company)'} | ${j.title} | ${j.location || 'N/A'}`);
        }
      }
    }
    console.log('\n(dry run — run without --dry-run to save results)');
  } else if (!args.dryRun) {
    if (args.seed) {
      console.log(`\nSeed run: ${newJobs.length} row(s) appended to ${SCAN_HISTORY_PATH} (status=seeded). No data/new/ files.`);
    } else if (written) {
      console.log(`\nResults: ${written.tsvPath}`);
      console.log(`Status:  ${written.jsonPath}`);
    }
  }

  // Exit 0 unless ALL attempted providers failed (skipped/skipped_budget don't count as attempts).
  const attempted = providerResults.filter((r) => r && ['ok', 'failed', 'soft_fail'].includes(r.status));
  if (attempted.length > 0 && attempted.every((r) => r.status === 'failed')) {
    console.error('\nAll providers failed.');
    process.exit(1);
  }
}

// Only run main() when invoked directly, not when imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
