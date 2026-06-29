// Cheerio wrappers + date helpers shared by the board providers
// (jobindex / jobnet / thehub / linkedin-guest / ...).
// Files prefixed with _ are never loaded as providers by scan.mjs.

// IMPORTANT: import from 'cheerio/slim', not 'cheerio'. The main entry pulls
// in undici (for fromURL, which we never use) and undici requires the `File`
// global — missing on Node 18, so `import 'cheerio'` crashes at load time.
// slim = htmlparser2-based parsing for both HTML and xmlMode; fine for scraping.
import * as cheerio from 'cheerio/slim';
import { fetchText } from './_http.mjs';

const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);

// loadHtml(urlOrHtml [, fetchOpts]) → cheerio $.
// Pass a URL to fetch+parse, or an already-fetched HTML string to just parse.
export async function loadHtml(urlOrHtml, fetchOpts = {}) {
  const html = isUrl(urlOrHtml) ? await fetchText(urlOrHtml, fetchOpts) : String(urlOrHtml ?? '');
  return cheerio.load(html);
}

// loadRss(urlOrXml [, fetchOpts]) → [{title, link, pubDate, description}].
// Parses RSS 2.0 <item> (and Atom <entry> as a fallback) with cheerio xmlMode.
// CDATA-wrapped fields come back as plain text. Fields default to ''.
export async function loadRss(urlOrXml, fetchOpts = {}) {
  const xml = isUrl(urlOrXml) ? await fetchText(urlOrXml, fetchOpts) : String(urlOrXml ?? '');
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item, entry').each((_, el) => {
    const $el = $(el);
    const text = (sel) => $el.find(sel).first().text().trim();
    // Atom feeds use <link href="..."/> instead of text content.
    const link = text('link') || $el.find('link').first().attr('href') || '';
    items.push({
      title: text('title'),
      link: link.trim(),
      pubDate: text('pubDate') || text('published') || text('updated') || text('dc\\:date'),
      description: text('description') || text('summary') || text('content'),
    });
  });
  return items;
}

// ── Date helpers — all return 'YYYY-MM-DD' or '' (never throw) ─────────

const DAY_MS = 86_400_000;
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n, now) => isoDay(new Date(now.getTime() - n * DAY_MS));

// Diacritic fold for matching relative-date phrases — must fold identically
// to scan.mjs normalize(): Danish "i går" → "i gar", "måneder" → "maneder".
function fold(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .replace(/ø/g, 'o')   // Danish ø
    .replace(/æ/g, 'ae')  // Danish æ
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

// RSS pubDate ("Tue, 09 Jun 2026 10:00:00 +0200") → ISO date.
export function rssDateToIso(s) {
  if (!s) return '';
  const d = new Date(String(s).trim());
  return Number.isNaN(d.getTime()) ? '' : isoDay(d);
}

// Relative phrases → ISO date. English ("3 days ago", "yesterday"), Danish
// ("i dag", "i går", "for 3 dage siden", "for en uge siden", "for 2 måneder
// siden"), and legacy Serbian ("pre 3 dana", "juče"). Matched on folded text.
export function relativeToIso(s, now = new Date()) {
  const t = fold(s);
  if (!t) return '';
  if (
    /^(today|danas|novo|just now|upravo( objavljeno)?)$/.test(t) ||
    /^i ?dag$/.test(t) ||
    /\b(hour|minute|second)s? ago\b/.test(t) ||
    /\bpre \d+ (sata|sati|casa|casova|minuta|sekundi)\b/.test(t) ||
    /^pre (sat|par sati|par minuta)/.test(t) ||
    /\bfor \d+ (?:timer?|minut(?:ter)?|sekund(?:er)?) siden\b/.test(t)
  ) return isoDay(now);
  if (/^(yesterday|juce)$/.test(t) || /\bpre 1 dan(a)?\b/.test(t)
      || /^i ?gar$/.test(t) || /\bfor 1 dag siden\b/.test(t)) return daysAgo(1, now);
  if (/^i ?forgars$/.test(t)) return daysAgo(2, now);
  let m = t.match(/(\d+)\+?\s*days? ago/) || t.match(/pre\s+(\d+)\s+dana/)
      || t.match(/for\s+(\d+)\s+dage\s+siden/);
  if (m) return daysAgo(Number(m[1]), now);
  m = t.match(/(\d+)\s*weeks? ago/) || t.match(/pre\s+(\d+)\s+nedelj/)
      || t.match(/for\s+(\d+)\s+uger\s+siden/);
  if (m) return daysAgo(Number(m[1]) * 7, now);
  if (/\ba week ago\b|\bpre nedelju dana\b|\bfor en uge siden\b/.test(t)) return daysAgo(7, now);
  m = t.match(/(\d+)\s*months? ago/) || t.match(/pre\s+(\d+)\s+mesec/)
      || t.match(/for\s+(\d+)\s+maned(?:er)?\s+siden/);
  if (m) return daysAgo(Number(m[1]) * 30, now);
  if (/\ba month ago\b|\bpre mesec dana\b|\bfor en maned siden\b/.test(t)) return daysAgo(30, now);
  return '';
}

// Best-effort: already-ISO → as-is; Danish/Euro absolute "10-06-2026" /
// "10.06.2026" / "10/06/2026" (DD-MM-YYYY) → ISO; relative phrase → ISO;
// RSS/parseable absolute → ISO; otherwise ''.
export function toIsoDate(s, now = new Date()) {
  if (!s) return '';
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\.?$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return relativeToIso(str, now) || rssDateToIso(str);
}
