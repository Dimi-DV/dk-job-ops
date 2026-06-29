// providers/jooble.mjs — Jooble official job-search API (https://jooble.org/api/about).
//
// POST https://jooble.org/api/{JOOBLE_API_KEY}   body: {"keywords": "...", "location": "Danmark"}
// One POST per configured keyword (default '' / engineer / analyst / administrator —
// '' is the broadest "everything in Danmark" query), responses merged and deduped
// by canonical link. politeDelay between requests; budget-deadline aware.
//
// Response shape (official docs; no live key at implementation time 2026-06-10 —
// mapping verified against the documented sample in test/jooble.test.mjs):
//   { totalCount: N, jobs: [ { title, location, snippet, salary, source, type,
//                              link, company, updated, id } ] }
//   - title/snippet may carry <b> keyword highlights + HTML entities → stripped here
//   - link is https://jooble.org/desc/<id>?ckey=...&rgn=...&pos=... → tracking query stripped
//   - updated is an ISO datetime ("2026-06-10T00:00:00.0000000") → posted 'YYYY-MM-DD'
//
// Key handling: JOOBLE_API_KEY from the environment, .env (repo root) loaded via
// dotenv. Missing key → throw { skip: true } → scan.mjs records status 'skipped'
// (NOT failed) per the provider contract. 401/403 → 'failed' (key present but bad);
// 429 → soft_fail (free-tier daily quota — expected occasionally).

import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadDotenv } from 'dotenv';
import { toIsoDate } from './_html.mjs';

// Load repo-root .env regardless of cwd; never overrides real env vars.
loadDotenv({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const DEFAULT_KEYWORDS = ['', 'engineer', 'analyst', 'administrator'];
const SNIPPET_MAX = 200;

// ── Pure mapping helpers (exported for test/jooble.test.mjs) ───────────

// Canonical ad URL: drop the tracking query (?ckey=&rgn=&pos=) + fragment.
export function stripTracking(link) {
  const s = String(link ?? '').trim();
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return s.split(/[?#]/)[0];
  }
}

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»',
};

// Snippets/titles carry <b> highlights + entities → plain collapsed text.
export function stripHtml(s) {
  return String(s ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, ent) => {
      if (ent[0] === '#') {
        const code = /^#x/i.test(ent) ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
        return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ' ';
      }
      return ENTITIES[ent.toLowerCase()] ?? m; // unknown named entity → leave as-is
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// One API response → Job[] (provider contract shape). Items without a link
// or title are dropped; dedup across keyword queries happens in fetch().
export function mapJoobleResponse(data) {
  const items = Array.isArray(data?.jobs) ? data.jobs : [];
  const jobs = [];
  for (const item of items) {
    const url = stripTracking(item?.link);
    const title = stripHtml(item?.title);
    if (!url || !title) continue;
    jobs.push({
      url,
      title,
      company: String(item?.company ?? '').trim(),
      location: String(item?.location ?? '').trim(),
      posted: toIsoDate(item?.updated),
      snippet: stripHtml(item?.snippet).slice(0, SNIPPET_MAX),
    });
  }
  return jobs;
}

// ── Provider ───────────────────────────────────────────────────────────

export default {
  id: 'jooble',

  detect(entry) {
    return /jooble\.org/.test(String(entry?.url ?? ''));
  },

  async fetch(entry, helpers) {
    const key = (process.env.JOOBLE_API_KEY || '').trim();
    if (!key) {
      throw Object.assign(
        new Error('JOOBLE_API_KEY not set — free key at https://jooble.org/api/about'),
        { skip: true },
      );
    }

    const base = String(entry.url || 'https://jooble.org/api/').replace(/\/+$/, '');
    const apiUrl = `${base}/${encodeURIComponent(key)}`;
    const location = entry.location || 'Danmark';
    const keywords = Array.isArray(entry.keywords) && entry.keywords.length > 0
      ? entry.keywords
      : DEFAULT_KEYWORDS;

    const byUrl = new Map(); // canonical link → job (first/broadest query wins)
    const errors = [];
    let succeeded = 0;

    for (let i = 0; i < keywords.length; i++) {
      if (i > 0) {
        if (Date.now() >= helpers.deadline) break;
        await helpers.politeDelay(helpers.requestDelayMs);
      }
      try {
        const res = await helpers.http.fetchWithRetry(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ keywords: keywords[i], location }),
          timeoutMs: 15_000,
        }, { retries: 1 });
        const data = await res.json();
        for (const job of mapJoobleResponse(data)) {
          if (!byUrl.has(job.url)) byUrl.set(job.url, job);
        }
        succeeded++;
      } catch (err) {
        errors.push(err);
        // Bad key → every request will fail identically; don't hammer the API.
        if (err?.status === 401 || err?.status === 403) break;
      }
    }

    if (succeeded === 0 && errors.length > 0) {
      const first = errors[0];
      if (first?.status === 429) {
        throw Object.assign(
          new Error(`Jooble API rate-limited (HTTP 429) — free-tier daily quota; expected occasionally`),
          { softFail: true },
        );
      }
      if (first?.status === 401 || first?.status === 403) {
        throw new Error(`Jooble API rejected the key (HTTP ${first.status}) — check JOOBLE_API_KEY`);
      }
      throw first;
    }
    if (errors.length > 0) {
      console.error(`⚠️  jooble: ${errors.length}/${keywords.length} keyword queries failed (${errors[0].message}) — returning partial results`);
    }
    return [...byUrl.values()];
  },
};
