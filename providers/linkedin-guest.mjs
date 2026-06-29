// LinkedIn guest jobs API provider (no auth).
//
// GET https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
//     ?keywords=&location=Denmark&f_TPR=r86400&start={0,25,50,75}
// Returns server-rendered HTML fragments (<li> job cards), ~10–25 cards/page.
//
// Verified live 2026-06-10:
//   <li> → div.base-search-card  (data-entity-urn="urn:li:jobPosting:…")
//     a[href*="/jobs/view/"]            → ad URL (rs.linkedin.com, tracking query — STRIPPED)
//     .base-search-card__title          → title
//     .base-search-card__subtitle       → company
//     .job-search-card__location        → location
//     time[datetime="YYYY-MM-DD"]       → posted (datetime attr; relative text fallback)
//
// Datacenter IPs are intermittently blocked (429 / 999 / empty body / authwall
// HTML with zero cards). That is EXPECTED → signal soft_fail per the scan.mjs
// contract: throw Object.assign(new Error(…), { softFail: true }).
// Jooble + the ATS feeds overlap this board's coverage, so a soft_fail day is fine.
//
// Politeness: hard cap of `max_requests` pages (portals.yml: 4) per run,
// single attempt per page (NO retries — re-hammering a rate limit from a DC IP
// is counterproductive), politeDelay between pages, stop early on a short/empty
// page or when every card on a page is already in seenUrls.

const PAGE_SIZE = 25; // the guest API's start= offset step
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

function softFail(message) {
  return Object.assign(new Error(message), { softFail: true });
}

// Canonical ad URL: strip tracking query + fragment from /jobs/view/ links.
function stripQuery(href) {
  try {
    const u = new URL(href);
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return String(href ?? '').split(/[?#]/)[0];
  }
}

function parseCards($, helpers) {
  const jobs = [];
  $('li').each((_, el) => {
    const $li = $(el);
    const href = $li.find('a[href*="/jobs/view/"]').first().attr('href');
    if (!href) return; // not a job card
    const $time = $li.find('time').first();
    const posted = helpers.html.toIsoDate($time.attr('datetime') || $time.text());
    jobs.push({
      url: stripQuery(href),
      title: $li.find('.base-search-card__title').first().text().trim(),
      company: $li.find('.base-search-card__subtitle').first().text().trim(),
      location: $li.find('.job-search-card__location').first().text().trim(),
      posted,
    });
  });
  return jobs;
}

export default {
  id: 'linkedin-guest',

  detect(entry) {
    return typeof entry.url === 'string' && entry.url.includes('linkedin.com');
  },

  async fetch(entry, helpers) {
    const base = entry.url || 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
    const maxRequests = Math.max(1, Math.min(entry.max_requests ?? 4, helpers.pageCap ?? 4));
    const jobs = [];

    for (let page = 0; page < maxRequests; page++) {
      if (page > 0) {
        if (Date.now() >= helpers.deadline) break;
        await helpers.politeDelay(helpers.requestDelayMs);
      }

      const params = new URLSearchParams({
        keywords: '',
        location: entry.location || 'Denmark',
        f_TPR: entry.time_window || 'r86400',
        start: String(page * PAGE_SIZE),
      });
      const url = `${base}?${params}`;

      let body;
      try {
        body = await helpers.http.fetchText(url, { headers: BROWSER_HEADERS });
      } catch (err) {
        // 4xx/429/999 = rate-limited/blocked guest access — expected from DC IPs.
        const blocked = err?.status != null && ((err.status >= 400 && err.status < 500) || err.status === 999);
        if (page === 0) {
          if (blocked) throw softFail(`LinkedIn guest API blocked (HTTP ${err.status}) — expected from datacenter IPs`);
          throw err; // network/5xx on first page → genuine failure
        }
        break; // later pages: keep what we already have
      }

      if (!body || !body.trim()) {
        // Empty body on page 0 = blocked; on later pages = normal end of results.
        if (page === 0) throw softFail('LinkedIn guest API returned an empty first page — likely rate-limited from this IP');
        break;
      }

      const $ = await helpers.html.loadHtml(body);
      const pageJobs = parseCards($, helpers);
      if (pageJobs.length === 0) {
        if (page === 0) throw softFail('LinkedIn guest API returned HTML with no job cards (authwall/block page)');
        break;
      }
      jobs.push(...pageJobs);

      // PAGINATION RULE: every card already known → no fresh ads deeper.
      if (pageJobs.every((j) => helpers.seenUrls.has(helpers.normalizeUrl(j.url)))) break;
      // Short page = last page of results — don't burn a request on an empty one.
      if (pageJobs.length < PAGE_SIZE) break;
    }

    // ── Tier-1 enrichment (2026-06-17) ──────────────────────────────────────
    // The search card carries no seniority/body — the single biggest Tier-1↔Tier-2
    // divergence source (Entry-vs-Mid-Senior hides in the JD). For each NEW (unseen)
    // card, fetch the guest jobPosting fragment and capture the seniority/employment
    // criteria + a JD excerpt into `snippet`. Best-effort + budget-bounded: a blocked
    // or failed enrichment simply leaves the snippet empty (no provider failure).
    for (const j of jobs) {
      if (Date.now() >= helpers.deadline) break;
      if (helpers.seenUrls.has(helpers.normalizeUrl(j.url))) continue; // only fresh ads
      const id = (j.url.match(/(\d{6,})$/) || [])[1];
      if (!id) continue;
      try {
        await helpers.politeDelay(helpers.requestDelayMs);
        const frag = await helpers.http.fetchText(
          `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
          { headers: BROWSER_HEADERS },
        );
        if (!frag || !frag.trim()) continue;
        const $$ = await helpers.html.loadHtml(frag);
        const crit = $$('.description__job-criteria-item')
          .map((_, el) => $$(el).text().replace(/\s+/g, ' ').trim()).get()
          .filter(Boolean).join(' | ');
        const body = ($$('.show-more-less-html__markup').text() || $$('.description__text').text() || '')
          .replace(/\s+/g, ' ').trim().slice(0, 280);
        j.snippet = [crit, body].filter(Boolean).join(' — ').slice(0, 400);
      } catch { /* best-effort enrichment — leave snippet empty on block/failure */ }
    }

    return jobs;
  },
};
