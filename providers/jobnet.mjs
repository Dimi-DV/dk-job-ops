// providers/jobnet.mjs — Jobnet / Job-DB (Denmark's public job database, run by
// STAR / Styrelsen for Arbejdsmarked og Rekruttering). Keyless public JSON search.
//
// ⚠️  VERIFY AT BUILD — the live endpoint, HTTP verb, query-param names, and
// response keys MUST be confirmed against job.jobnet.dk: open the site, run a
// search, and read the Network tab.
//
// BUILD-TIME OBSERVATION (2026-06, from a datacenter IP): job.jobnet.dk is
// fronted by the Myra WAF, and `/CV/FindWork` now 301-redirects to an
// IdentityServer login (identityserver-prod.starplatform.dk) — i.e. the assumed
// SearchPublishedJobs path is auth/WAF-walled from outside Denmark. From a Danish
// residential IP this is usually reachable: find the CURRENT anonymous search
// request in the Network tab (or use STAR's official open-data job feed) and set
// the board's `api:` + params accordingly. Until then Jobnet records `failed`
// (visible in the providers JSON) and the scan still succeeds on the other boards.
//
// The mapping targets the documented "JobPositionPostings" shape and uses
// defensive multi-key field fallbacks, so a
// renamed field yields '' (row dropped) rather than a crash. If a scan returns
// status=failed with "no recognizable postings array", the shape has changed —
// re-map against the live JSON. mapJobnetResponse()/canonicalJobnetUrl() are
// exported for test/jobnet.test.mjs (hardcoded sample, no network).

import { toIsoDate } from './_html.mjs';

const DEFAULT_ENDPOINT = 'https://job.jobnet.dk/CV/FindWork/SearchPublishedJobs';
const DEFAULT_KEYWORDS = ['', 'engineer', 'developer', 'analyst']; // '' = broadest sweep
const PAGE_SIZE = 20;   // VERIFY the page size the API actually returns
const SNIPPET_MAX = 200;

// Stable canonical URL — prefer the jobnet detail page (stable id) over a
// volatile employer apply link. VERIFY the real id field + detail path.
export function canonicalJobnetUrl(posting) {
  const id = posting?.ID ?? posting?.Id ?? posting?.JobId ?? posting?.id;
  if (id != null && String(id).trim()) return `https://job.jobnet.dk/CV/FindWork/Job/${id}`;
  const ext = posting?.DetailsUrl || posting?.Url || posting?.url || '';
  try {
    const u = new URL(ext);
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return String(ext || '').split(/[?#]/)[0];
  }
}

// One API response → Job[] (provider contract). Drops items without url/title.
export function mapJobnetResponse(data) {
  const items = Array.isArray(data?.JobPositionPostings) ? data.JobPositionPostings
              : Array.isArray(data?.jobs) ? data.jobs
              : Array.isArray(data?.Jobs) ? data.Jobs : [];
  const out = [];
  for (const p of items) {
    const url = canonicalJobnetUrl(p);
    const title = String(p?.Title ?? p?.JobHeadline ?? p?.Headline ?? '').trim();
    if (!url || !title) continue;
    const location = [p?.WorkPlaceCity, p?.WorkPlacePostalCode, p?.WorkPlaceAddress]
      .map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
    out.push({
      url,
      title,
      company: String(p?.HiringOrgName ?? p?.Employer ?? '').trim(),
      location,
      posted: toIsoDate(p?.PostingCreated ?? p?.PublicationStartDate ?? p?.PostingDate ?? ''),
      snippet: String(p?.JobDescription ?? p?.Presentation ?? '')
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX),
    });
  }
  return out;
}

function hasPostingsArray(data) {
  return Array.isArray(data?.JobPositionPostings)
      || Array.isArray(data?.jobs)
      || Array.isArray(data?.Jobs);
}

function buildSearchUrl(base, keyword, offset, location) {
  const u = new URL(base);
  u.searchParams.set('SearchString', keyword);      // VERIFY param names
  u.searchParams.set('Offset', String(offset));
  u.searchParams.set('SortValue', 'CreationDate');  // date-desc → seenUrls early-stop valid
  if (location) u.searchParams.set('LocationZip', location); // VERIFY/optional; else lean on location_filter
  return u.toString();
}

export default {
  id: 'jobnet',

  detect(entry) {
    return /jobnet\.dk/.test(String(entry?.url ?? '') + String(entry?.api ?? ''));
  },

  async fetch(entry, helpers) {
    const base = entry.api || entry.url || DEFAULT_ENDPOINT;
    const keywords = Array.isArray(entry.keywords) && entry.keywords.length ? entry.keywords : DEFAULT_KEYWORDS;
    const maxPages = Math.max(1, Math.min(entry.max_requests ?? 4, helpers.pageCap));
    const byUrl = new Map();
    const errors = [];
    let gotResponse = false;
    let sawArray = false;

    for (let k = 0; k < keywords.length; k++) {
      if (Date.now() >= helpers.deadline) break;
      let knownTotal = 0;
      for (let page = 0; page < maxPages; page++) {
        if (Date.now() >= helpers.deadline) break;
        if (page > 0 || k > 0) await helpers.politeDelay(helpers.requestDelayMs);
        let data;
        try {
          const res = await helpers.http.fetchWithRetry(
            buildSearchUrl(base, keywords[k], page * PAGE_SIZE, entry.location),
            { headers: { accept: 'application/json' }, timeoutMs: 15_000 },
            { retries: 1 },
          );
          data = await res.json();
        } catch (err) {
          errors.push(err);
          if (err?.status === 401 || err?.status === 403) { k = keywords.length; break; }
          break; // next keyword
        }
        gotResponse = true;
        if (hasPostingsArray(data)) sawArray = true;
        const pageJobs = mapJobnetResponse(data);
        const total = Number(data?.TotalResultCount ?? data?.totalCount);
        if (total > 0) knownTotal = total;
        if (pageJobs.length === 0) break;
        let allSeen = true;
        for (const j of pageJobs) {
          if (!helpers.seenUrls.has(helpers.normalizeUrl(j.url))) allSeen = false;
          if (!byUrl.has(j.url)) byUrl.set(j.url, j);
        }
        if (allSeen) break;                                          // date-sorted → nothing newer
        if (knownTotal > 0 && (page + 1) * PAGE_SIZE >= knownTotal) break;
        if (pageJobs.length < PAGE_SIZE) break;
      }
    }

    if (!gotResponse && errors.length) {
      const first = errors[0];
      if (first?.status === 429) throw Object.assign(new Error('Jobnet API rate-limited (HTTP 429)'), { softFail: true });
      throw first;
    }
    if (gotResponse && !sawArray) {
      throw new Error('jobnet: response had no recognizable postings array — endpoint/shape changed (VERIFY against job.jobnet.dk Network tab)');
    }
    return [...byUrl.values()];
  },
};
