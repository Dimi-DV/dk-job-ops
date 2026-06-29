// providers/thehub.mjs — thehub.io (Denmark/Nordics startup & tech job board).
// The listings are rendered client-side from an Algolia index, so the server
// HTML carries no job cards — we query Algolia's public search endpoint directly.
//
// ⚠️  VERIFY AT BUILD — the Algolia appId, search-only apiKey, index name, and
// hit field names below are ASSUMPTIONS. Read them once from thehub.io's Network
// tab (look for a request to `https://{APPID}-dsn.algolia.net/.../query` with
// `X-Algolia-Application-Id` / `X-Algolia-API-Key` headers) and put them in the
// portals.yml entry under `algolia: { app_id, api_key, index }` — that is the
// durable, preferred path. The HTML key auto-extraction below is a fragile
// fallback. mapAlgoliaHits() is exported for test/thehub.test.mjs (no network).
//
// The Algolia "API key" here is the PUBLIC search-only token shipped to every
// browser — fine to commit in portals.yml; it is not a secret.

const SNIPPET_MAX = 200;

function algoliaConfig(entry, htmlText) {
  if (entry?.algolia?.app_id && entry?.algolia?.api_key && entry?.algolia?.index) return entry.algolia;
  if (!htmlText) return null;
  const appId = htmlText.match(/application[_-]?id["'\s:=]+([A-Z0-9]{8,})/i)?.[1];
  const apiKey = htmlText.match(/(?:search[_-]?only[_-]?)?api[_-]?key["'\s:=]+([a-f0-9]{20,})/i)?.[1];
  const index = htmlText.match(/index(?:Name)?["'\s:=]+([a-z0-9_]*jobs?[a-z0-9_]*)/i)?.[1] || 'jobs';
  if (appId && apiKey) return { app_id: appId, api_key: apiKey, index };
  return null;
}

// One Algolia response → Job[] (provider contract). Pure & testable.
// `toIso` (e.g. helpers.html.toIsoDate) converts ISO-string timestamps; numeric
// epoch (s or ms) is handled inline. VERIFY hit field names against live data.
export function mapAlgoliaHits(json, { origin = 'https://thehub.io', toIso } = {}) {
  const hits = Array.isArray(json?.hits) ? json.hits : [];
  const out = [];
  for (const h of hits) {
    const slug = h?.slug || h?.objectID || '';
    const url = h?.url || (slug ? `${origin}/jobs/${slug}` : '');
    const title = String(h?.title ?? h?.jobTitle ?? h?.headline ?? '').trim();
    if (!url || !title) continue;
    const ts = h?.createdAt ?? h?.publishedAt ?? h?.published ?? h?.created ?? '';
    let posted = '';
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      posted = new Date(ts < 1e12 ? ts * 1000 : ts).toISOString().slice(0, 10);
    } else if (ts && typeof toIso === 'function') {
      posted = toIso(ts);
    }
    out.push({
      url,
      title,
      company: String(h?.companyName ?? h?.company?.name ?? h?.company ?? '').trim(),
      location: String(h?.location ?? h?.address ?? h?.city ?? '').trim(),
      posted,
      snippet: String(h?.description ?? h?.teaser ?? '')
        .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX),
    });
  }
  return out;
}

export default {
  id: 'thehub',

  detect(entry) {
    return /thehub\.io/.test(String(entry?.url ?? ''));
  },

  async fetch(entry, helpers) {
    let cfg = algoliaConfig(entry, null);
    if (!cfg && entry.url) {
      try {
        cfg = algoliaConfig(entry, await helpers.http.fetchText(entry.url, { headers: { 'accept-language': 'da,en;q=0.8' } }));
      } catch { /* fall through to the throw below */ }
    }
    if (!cfg) {
      throw new Error('thehub: no Algolia credentials — set entry.algolia:{app_id,api_key,index} from the thehub.io Network tab (VERIFY)');
    }

    const endpoint = `https://${cfg.app_id.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(cfg.index)}/query`;
    const headers = {
      'content-type': 'application/json',
      'X-Algolia-Application-Id': cfg.app_id,
      'X-Algolia-API-Key': cfg.api_key,
    };
    const maxPages = Math.max(1, Math.min(entry.max_requests ?? 3, helpers.pageCap));
    const byUrl = new Map();

    for (let page = 0; page < maxPages; page++) {
      if (Date.now() >= helpers.deadline) break;
      if (page > 0) await helpers.politeDelay(helpers.requestDelayMs);
      const facet = entry.location
        ? `&facetFilters=${encodeURIComponent(JSON.stringify([[`location:${entry.location}`]]))}` : '';
      const params = `query=${encodeURIComponent(entry.keyword || '')}&hitsPerPage=50&page=${page}${facet}`;
      let json;
      try {
        const res = await helpers.http.fetchWithRetry(
          endpoint,
          { method: 'POST', headers, body: JSON.stringify({ params }), timeoutMs: 15_000 },
          { retries: 1 },
        );
        json = await res.json();
      } catch (err) {
        if (page === 0) {
          if (err?.status === 429) throw Object.assign(err, { softFail: true });
          throw err;
        }
        break;
      }
      const hits = mapAlgoliaHits(json, { toIso: helpers.html.toIsoDate });
      if (hits.length === 0) break;
      let allSeen = true;
      for (const j of hits) {
        if (!helpers.seenUrls.has(helpers.normalizeUrl(j.url))) allSeen = false;
        if (!byUrl.has(j.url)) byUrl.set(j.url, j);
      }
      if (allSeen) break;
      if (page + 1 >= Number(json?.nbPages ?? 1)) break;
    }
    return [...byUrl.values()];
  },
};
