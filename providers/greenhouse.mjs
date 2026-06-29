// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Greenhouse provider — hits the public boards-api JSON endpoint.
// Handles both explicit `api:` URLs and auto-detection from `careers_url`.
//
// EU data residency (dk-job-ops patch): boards hosted on job-boards.eu.greenhouse.io
// serve their JSON from https://boards.eu.greenhouse.io/v1/boards/{slug}/jobs.
// NOTE: `boards-api.eu.greenhouse.io` does NOT exist (NXDOMAIN, verified
// 2026-06-10) — the EU API lives on boards.eu.greenhouse.io. An explicit
// `api:` field on the portals.yml entry always wins over careers_url detection.

import { jdExcerpt } from './ashby.mjs'; // shared Tier-1 snippet-enrichment helper

const ALLOWED_GREENHOUSE_HOSTS = new Set([
  'boards-api.greenhouse.io',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'job-boards.eu.greenhouse.io',
  'boards.eu.greenhouse.io',     // EU API host (boards-api.eu.* is NXDOMAIN)
]);

function assertGreenhouseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`greenhouse: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`greenhouse: URL must use HTTPS: ${url}`);
  if (!ALLOWED_GREENHOUSE_HOSTS.has(parsed.hostname))
    throw new Error(`greenhouse: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_GREENHOUSE_HOSTS].join(', ')}`);
  return url;
}

function resolveApiUrl(entry) {
  if (entry.api) {
    assertGreenhouseUrl(entry.api);
    return entry.api;
  }
  const url = entry.careers_url || '';
  // job-boards[.eu].greenhouse.io/{slug} or boards[.eu].greenhouse.io/{slug};
  // a .eu careers host routes to the EU API host (boards.eu.greenhouse.io).
  const match = url.match(/(?:job-)?boards(\.eu)?\.greenhouse\.io\/([^/?#]+)/);
  if (match) {
    const apiHost = match[1] ? 'boards.eu.greenhouse.io' : 'boards-api.greenhouse.io';
    return `https://${apiHost}/v1/boards/${match[2]}/jobs`;
  }
  return null;
}

/** @type {Provider} */
export default {
  id: 'greenhouse',

  detect(entry) {
    try {
      const apiUrl = resolveApiUrl(entry);
      return apiUrl ? { url: apiUrl } : null;
    } catch {
      return null;
    }
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`greenhouse: cannot derive API URL for ${entry.name}`);
    assertGreenhouseUrl(apiUrl);
    // redirect:'error' prevents SSRF via server-side redirects; combined with
    // assertGreenhouseUrl above it guarantees the final hostname stays in the allowlist.
    // content=true returns the full JD body per job in one list fetch (no per-job calls)
    const fetchUrl = apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'content=true';
    const json = await ctx.fetchJson(fetchUrl, { redirect: 'error' });
    const jobs = Array.isArray(json?.jobs) ? json.jobs : [];
    return jobs.filter(j => j.absolute_url).map(j => ({
      title: j.title || '',
      url: j.absolute_url,
      company: entry.name,
      location: j.location?.name || '',
      snippet: jdExcerpt(j.content), // entity-encoded HTML body → plain excerpt for Tier-1
    }));
  },
};
