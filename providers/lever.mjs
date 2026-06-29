// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Lever provider — hits the public postings endpoint.
// Auto-detects from careers_url pattern `https://jobs[.eu].lever.co/<slug>`.
//
// EU data residency (dk-job-ops patch): boards on jobs.eu.lever.co serve their
// JSON from https://api.eu.lever.co/v0/postings/{slug} (verified 2026-06-10).
// An explicit `api:` field on the portals.yml entry always wins over
// careers_url detection; its host must be in the allowlist below.

const ALLOWED_LEVER_HOSTS = new Set(['api.lever.co', 'api.eu.lever.co']);

function assertLeverUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`lever: invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error(`lever: URL must use HTTPS: ${url}`);
  if (!ALLOWED_LEVER_HOSTS.has(parsed.hostname))
    throw new Error(`lever: untrusted hostname "${parsed.hostname}" — must be one of: ${[...ALLOWED_LEVER_HOSTS].join(', ')}`);
  return url;
}

function resolveApiUrl(entry) {
  if (entry.api) {
    assertLeverUrl(entry.api);
    return entry.api;
  }
  const url = entry.careers_url || '';
  const match = url.match(/jobs(\.eu)?\.lever\.co\/([^/?#]+)/);
  if (!match) return null;
  const apiHost = match[1] ? 'api.eu.lever.co' : 'api.lever.co';
  return `https://${apiHost}/v0/postings/${match[2]}?mode=json`;
}

/** @type {Provider} */
export default {
  id: 'lever',

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
    if (!apiUrl) throw new Error(`lever: cannot derive API URL for ${entry.name}`);
    const json = await ctx.fetchJson(apiUrl);
    if (!Array.isArray(json)) return [];
    return json.map(j => ({
      title: j.text || '',
      url: j.hostedUrl || '',
      company: entry.name,
      location: j.categories?.location || '',
    }));
  },
};
