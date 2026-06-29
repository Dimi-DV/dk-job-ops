// HTTP transport helpers shared across providers.
// Files prefixed with _ are never loaded as providers by scan.mjs.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; dk-job-ops/1.0)';

async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, method = 'GET', body = null, redirect = 'follow' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'user-agent': DEFAULT_USER_AGENT, ...headers },
      body,
      redirect,
      signal: controller.signal,
    });
    if (!res.ok) {
      const responseText = await res.text().catch(() => '');
      const snippet = responseText.replace(/\s+/g, ' ').trim().slice(0, 300);
      const err = new Error(snippet ? `HTTP ${res.status}: ${snippet}` : `HTTP ${res.status}`);
      err.status = res.status;
      err.body = responseText;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.json();
}

export async function fetchText(url, opts = {}) {
  const res = await fetchWithTimeout(url, opts);
  return await res.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// politeDelay(baseMs) — jittered sleep between paginated requests to the same
// host (0.5x–1.5x of base). Board providers MUST call this between pages.
export function politeDelay(baseMs = 500) {
  return sleep(Math.round(baseMs * (0.5 + Math.random())));
}

// Statuses worth a retry: timeouts, rate limits, transient server errors.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// fetchWithRetry — fetchWithTimeout plus exponential backoff w/ jitter on
// network errors (no .status) and retryable HTTP statuses. Non-retryable HTTP
// errors (403/404/...) throw immediately. Returns the raw Response on success.
export async function fetchWithRetry(url, opts = {}, { retries = 2, backoffMs = 1000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 300));
    try {
      return await fetchWithTimeout(url, opts);
    } catch (err) {
      lastErr = err;
      const retryable = err?.status === undefined || RETRYABLE_STATUS.has(err.status);
      if (!retryable) throw err;
    }
  }
  throw lastErr;
}

export function makeHttpCtx() {
  return {
    transport: 'http',
    fetchJson,
    fetchText,
    fetchWithRetry,
    politeDelay,
  };
}
