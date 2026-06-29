// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Ashby provider — hits the public posting-api endpoint.
// Auto-detects from careers_url pattern `https://jobs.ashbyhq.com/<slug>`.
//
// Ashby's public posting-api carries a ~10s+ server-side latency floor
// (response time is independent of board size) and rate-limits repeated
// unauthenticated hits. The global default timeout (10s, providers/_http.mjs)
// sits right on that floor, so requests race the timeout and abort. We give
// Ashby a longer timeout plus a backoff+jitter retry (the backoff spaces
// requests out to dodge rate-limiting).
// See .planning/codebase/ashby-scan-abort-diagnosis.md.
const ASHBY_TIMEOUT_MS = 30_000;
const ASHBY_RETRIES = 2;

function resolveApiUrl(entry) {
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.ashbyhq.com/posting-api/job-board/${match[1]}?includeCompensation=true`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tier-1 enrichment (2026-06-17): collapse a JD body (HTML or entity-encoded HTML)
// to a plain-text excerpt so the scanner's `snippet` carries seniority/stack signal,
// not just title — shrinks Tier-1↔Tier-2 divergence. Shared shape across providers.
export function jdExcerpt(raw, max = 300) {
  return String(raw ?? '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>') // greenhouse double-encodes; harmless on plain HTML
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

/** @type {Provider} */
export default {
  id: 'ashby',

  detect(entry) {
    const apiUrl = resolveApiUrl(entry);
    return apiUrl ? { url: apiUrl } : null;
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`ashby: cannot derive API URL for ${entry.name}`);

    let lastErr;
    for (let attempt = 0; attempt <= ASHBY_RETRIES; attempt++) {
      if (attempt > 0) {
        // exponential backoff + jitter — spaces out retries to dodge Ashby rate-limiting
        const backoff = 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
        await sleep(backoff);
      }
      try {
        const json = await ctx.fetchJson(apiUrl, { timeoutMs: ASHBY_TIMEOUT_MS });
        const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
        return jobs.map((j) => ({
          title: j.title || '',
          url: j.jobUrl || '',
          company: entry.name,
          location: j.location || '',
          // enrich snippet from the description we already fetched (free) — seniority/stack for Tier-1
          snippet: [j.employmentType, j.department || j.team, jdExcerpt(j.descriptionHtml || j.descriptionPlain)]
            .filter(Boolean).join(' · '),
        }));
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  },
};
