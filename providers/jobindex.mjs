// providers/jobindex.mjs — jobindex.dk (Denmark's dominant general job board). HTML scrape.
//
// ⚠️  VERIFY AT BUILD — every CSS selector, the search-URL geo-slug, the
// pagination param, and the ad-URL shape below are ASSUMPTIONS. Confirm against
// live HTML (view-source on a jobindex.dk search result page). Selector drift →
// 0 cards → soft_fail on page 1 (visible in the providers JSON), never a crash.
//
// ⚠️  ANTI-BOT — jobindex.dk fronts Cloudflare. From datacenter / GitHub-Actions
// IPs a 403/503/challenge or a 0-card page on page 1 is EXPECTED and treated as
// soft_fail (the scan still succeeds on Jobnet + LinkedIn + TheHub). If Cloudflare
// is persistent, a Playwright-rendered fetch (playwright is already a dependency)
// is the documented v2 escalation.

const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'da,en;q=0.8',
};
const softFail = (m) => Object.assign(new Error(m), { softFail: true });

// Canonical, query-stripped ad URL — the id MUST live in the path (VERIFY).
function canonicalAdUrl(href, origin) {
  try {
    const u = new URL(href, origin);
    return `https://${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

// Parse one listing page → Job[]. ALL selectors VERIFY AT BUILD.
export function parseListingPage($, origin, helpers) {
  const jobs = [];
  $('div.jobsearch-result, div.jix_robotjob, div.PaidJob').each((_, card) => {
    const $c = $(card);
    const $a = $c.find('a[href]')
      .filter((_, a) => /\/(vis-job|job|stilling)\//i.test($(a).attr('href') || '')).first();
    const href = $a.attr('href') || $c.find('h4 a, b a').first().attr('href') || '';
    const url = canonicalAdUrl(href, origin);
    const title = ($a.text().trim() || $c.find('h4 a, b a').first().text().trim()).replace(/\s+/g, ' ');
    if (!url || !title) return;
    const dateText = ($c.find('time').first().attr('datetime')
      || $c.find('time, .jix_robotjob--date, .jobsearch-result__date').first().text() || '').trim();
    jobs.push({
      url,
      title,
      company: $c.find('.jix_robotjob--company, .jobsearch-result__company, b').first().text().trim(),
      location: $c.find('.jix_robotjob--area, .jobsearch-result__area, .jix_robotjob--location').first().text().trim(),
      posted: helpers.html.toIsoDate(dateText),
      snippet: $c.find('p, .jobsearch-result__teaser').first().text().replace(/\s+/g, ' ').trim().slice(0, 200),
    });
  });
  return jobs;
}

export default {
  id: 'jobindex',

  detect(entry) {
    return /jobindex\.dk/.test(String(entry?.url ?? ''));
  },

  async fetch(entry, helpers) {
    const base = entry.url || 'https://www.jobindex.dk/jobsoegning/storkoebenhavn';
    const origin = new URL(base).origin;
    const maxPages = Math.max(1, Math.min(entry.max_requests ?? helpers.pageCap, helpers.pageCap));
    const byUrl = new Map();

    for (let page = 1; page <= maxPages; page++) {
      if (Date.now() >= helpers.deadline) break;
      if (page > 1) await helpers.politeDelay(helpers.requestDelayMs);
      const u = new URL(base);
      u.searchParams.set('page', String(page));      // VERIFY param (page= vs ?side=)
      if (entry.keyword) u.searchParams.set('q', entry.keyword);
      let $;
      try {
        const res = await helpers.http.fetchWithRetry(u.toString(), { headers: BROWSER_HEADERS, timeoutMs: 15_000 }, { retries: 1 });
        $ = await helpers.html.loadHtml(await res.text());
      } catch (err) {
        const blocked = err?.status === 403 || err?.status === 429 || err?.status === 503;
        if (page === 1) {
          if (blocked) throw softFail(`jobindex blocked (HTTP ${err.status}) — expected from datacenter IPs (Cloudflare)`);
          throw err;
        }
        break; // keep partial results from earlier pages
      }
      const pageJobs = parseListingPage($, origin, helpers);
      if (pageJobs.length === 0) {
        if (page === 1) throw softFail('jobindex: 0 result cards on page 1 — Cloudflare challenge or selector drift (VERIFY selectors)');
        break;
      }
      let allSeen = true;
      for (const j of pageJobs) {
        if (!helpers.seenUrls.has(helpers.normalizeUrl(j.url))) allSeen = false;
        if (!byUrl.has(j.url)) byUrl.set(j.url, j);
      }
      if (allSeen) break;
    }
    return [...byUrl.values()];
  },
};
