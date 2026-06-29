// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Workday provider — public CXS search API. Unlocks the ENTERPRISE LONG TAIL
// (banks, Fortune 500, MSPs, consultancies, data-center operators) where most
// junior / new-grad / analyst / rotational programs live — almost none of which
// are on Greenhouse/Lever/Ashby. Each company is its own Workday tenant.
//
// Configure via the public myworkdayjobs careers_url (provider parses it), e.g.:
//   - { name: "Capital One", provider: workday, enabled: true,
//       careers_url: https://capitalone.wd1.myworkdayjobs.com/Capital_One,
//       workday: { searchText: "cloud", limit: 100 } }
//   Find a company's careers_url by opening their careers site and copying the
//   *.{wdN}.myworkdayjobs.com/{Site} URL. Optional usajobs-style tunables in the
//   workday:{} block — searchText (server-side keyword), limit (cap per scan).
//
// Auto-updater note: providers/ is in SYSTEM_PATHS; this untracked addition
// survives `git checkout -- providers/`, but re-check after updates. (See CLAUDE.local.md.)

const MAX_CAP = 1000;
const PAGE = 20; // Workday CXS hard-caps a page at 20

function parseTenant(entry) {
  const url = entry.careers_url || '';
  // https://{tenant}.{dc}.myworkdayjobs.com[/{locale}]/{site}
  const m = url.match(/https?:\/\/([^.]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:([a-z]{2}-[A-Z]{2})\/)?([^/?#]+)/i);
  if (!m) return null;
  return { tenant: m[1], dc: m[2], locale: m[3] || 'en-US', site: m[4], host: `${m[1]}.${m[2]}.myworkdayjobs.com` };
}

/** @type {Provider} */
export default {
  id: 'workday',

  detect(entry) {
    return /\.myworkdayjobs\.com\//i.test(entry && entry.careers_url || '') ? { url: entry.careers_url } : null;
  },

  async fetch(entry, ctx) {
    const p = parseTenant(entry);
    if (!p) {
      throw new Error(`workday: cannot parse careers_url for ${entry.name} (expected https://{tenant}.wdN.myworkdayjobs.com/{Site})`);
    }
    const cfg = (entry && entry.workday) || {};
    const searchText = cfg.searchText || '';
    const cap = Math.min(Number(cfg.limit) || 100, MAX_CAP);
    const api = `https://${p.host}/wday/cxs/${p.tenant}/${p.site}/jobs`;
    const headers = { 'content-type': 'application/json', accept: 'application/json' };

    const out = [];
    const seen = new Set();
    let offset = 0;
    // Many Workday CXS tenants report the real `total` ONLY on the first page and
    // return total:0 on every subsequent page (while still serving a full page of
    // jobPostings). Capturing the first non-zero total — instead of `|| out.length`
    // — avoids breaking pagination after page 2. `offset < cap` is a hard ceiling so
    // a tenant that ignores offset (repeats page 1) can't loop forever; dedup by url
    // then drops the repeats. (Verified 2026-06-03: QTS reports total 242 on page 1,
    // 0 thereafter — the old `|| out.length` capped every tenant at 40.)
    let knownTotal = 0;
    while (out.length < cap && offset < cap) {
      const body = JSON.stringify({ appliedFacets: {}, limit: PAGE, offset, searchText });
      const json = await ctx.fetchJson(api, { method: 'POST', headers, body });
      const posts = Array.isArray(json?.jobPostings) ? json.jobPostings : [];
      if (posts.length === 0) break;
      const pageTotal = Number(json?.total);
      if (pageTotal > 0) knownTotal = pageTotal;
      for (const j of posts) {
        const ext = j.externalPath || '';
        // Public posting URL: https://{host}/{locale}/{site}{externalPath}
        const url = ext ? `https://${p.host}/${p.locale}/${p.site}${ext}` : '';
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({
          title: j.title || '',
          url,
          company: entry.name,
          location: j.locationsText || '',
        });
      }
      offset += PAGE;
      if (posts.length < PAGE) break;                     // last (partial) page
      if (knownTotal > 0 && offset >= knownTotal) break;  // reached the known total
    }
    return out;
  },
};
