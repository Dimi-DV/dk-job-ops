#!/usr/bin/env node
// dashboard.mjs — static HTML dashboard / site generator over the dk-job-ops pipeline.
//
//   node dashboard.mjs [--out=output/dashboard.html]   single-file dashboard (local use)
//   node dashboard.mjs --site[=site]                   full static site: index.html +
//                                                      reports/NNN.html + cv/*.pdf + robots.txt
//                                                      (static export — host wherever you like)
//
// Zero LLM, zero server: parses data/applications.md (canonical status) and each
// report's Machine Summary YAML (apply url, band, family, cv path).

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs'
import { resolve, dirname, relative, basename } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import { marked } from 'marked'

const ROOT = dirname(fileURLToPath(import.meta.url))
const siteArg = process.argv.find(a => a === '--site' || a.startsWith('--site='))
const SITE_DIR = siteArg ? resolve(ROOT, siteArg.includes('=') ? siteArg.slice(7) : 'site') : null
const OUT = SITE_DIR
  ? resolve(SITE_DIR, 'index.html')
  : resolve(ROOT, (process.argv.find(a => a.startsWith('--out=')) || '--out=output/dashboard.html').slice(6))
if (SITE_DIR) { mkdirSync(resolve(SITE_DIR, 'reports'), { recursive: true }); mkdirSync(resolve(SITE_DIR, 'cv'), { recursive: true }) }

// ---- parse tracker ----------------------------------------------------------
const tracker = readFileSync(resolve(ROOT, 'data/applications.md'), 'utf8')
const rows = []
for (const line of tracker.split('\n')) {
  const m = line.match(/^\| (\d{3}) \|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|(.*)\|\s*$/)
  if (!m) continue
  const [, num, date, company, role, lang, closes, score, status, pdf, report, notes] = m.map(s => (s || '').trim())
  const reportRel = (report.match(/\(([^)]+)\)/) || [])[1] || ''
  rows.push({ num, date, company, role, lang, closes, score, status, pdf, reportRel, notes })
}

// ---- scan ledger: url → which scan found it ----------------------------------
const scanSeen = new Map() // url → { date: first_seen, seeded: from-initial-seed }
try {
  for (const line of readFileSync(resolve(ROOT, 'data/scan-history.tsv'), 'utf8').split('\n').slice(1)) {
    const c = line.split('\t')
    if (c.length < 6 || !c[0]) continue
    if (!scanSeen.has(c[0])) scanSeen.set(c[0], { date: c[1], seeded: c[5] === 'seeded' })
  }
} catch { /* ledger optional — dashboard renders without provenance */ }

// ---- augment from Machine Summaries -----------------------------------------
for (const r of rows) {
  r.url = ''; r.band = ''; r.family = ''; r.cv = ''
  if (!r.reportRel) continue
  const p = resolve(ROOT, 'data', r.reportRel) // links are written relative to data/
  if (!existsSync(p)) continue
  const md = readFileSync(p, 'utf8')
  const y = md.match(/```yaml\n([\s\S]*?)```/)
  if (!y) continue
  try {
    const ms = yaml.load(y[1].replace(/^## Machine Summary\n/m, '')) || {}
    r.url = ms.url || ''
    r.band = ms.band || ''
    r.family = ms.family || ''
    r.cv = ms.cv && ms.cv !== 'null' ? String(ms.cv) : ''
    if (!r.closes || r.closes === '—') r.closes = ms.closes && ms.closes !== 'null' ? String(ms.closes) : '—'
  } catch { /* malformed summary — tracker row still renders */ }
  r.reportAbs = p
}
for (const r of rows) {
  const hit = r.url ? (scanSeen.get(r.url) || scanSeen.get(r.url.replace(/\/$/, ''))) : null
  r.scan = hit ? hit.date : ''
  r.scanSeeded = hit ? hit.seeded : false
}

// ---- derived ---------------------------------------------------------------
const today = new Date(); today.setHours(0, 0, 0, 0)
const daysLeft = (c) => {
  if (!c || c === '—') return null
  const d = new Date(c + 'T00:00:00')
  return Math.round((d - today) / 86400000)
}
const daysAgo = (d) => d ? Math.round((today - new Date(d + 'T00:00:00')) / 86400000) : null
for (const r of rows) { r.days = daysLeft(r.closes); r.scanAge = daysAgo(r.scan) }

// ---- unevaluated finds from the daily scan reports ----------------------------
// PRIORITY/APPLY bucket lines from the last 5 daily reports whose URL has no
// tracker row yet — fresh roles visible on the web before Tier-2 evaluation.
const trackedUrls = new Set(rows.map(r => r.url).filter(Boolean))
const normKey = (c, t) => (c + '|' + t).toLowerCase().replace(/[^a-z0-9|]+/g, ' ').trim()
const trackedKeys = new Set(rows.map(r => normKey(r.company, r.role)))
const scanFinds = []
try {
  const dailyDir = resolve(ROOT, 'data/daily')
  const files = readdirSync(dailyDir).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().slice(-5).reverse()
  for (const f of files) {
    const scanDate = f.slice(0, 10)
    for (const part of readFileSync(resolve(dailyDir, f), 'utf8').split(/^## /m).slice(1)) {
      const bucket = part.startsWith('PRIORITY') ? 'PRIORITY' : part.startsWith('APPLY') ? 'APPLY' : null
      if (!bucket) continue
      for (const m of part.matchAll(/^\*\*(.+?)\*\* — (.+?) · F(\d) · (sr|en) · A\d\/P\d\/U\d → ([\d.]+)(.*?)\[([a-z-]+)\]\((https?:[^)]+)\)/gm)) {
        const [, title, company, fam, lang, score, mid, source, url] = m
        if (trackedUrls.has(url) || trackedKeys.has(normKey(company, title)) || scanFinds.some(x => x.url === url)) continue
        const closes = (mid.match(/closes (\d{4}-\d{2}-\d{2})/) || [])[1] || '—'
        scanFinds.push({ title, company, family: 'F' + fam, lang, score, source, url,
          scan: scanDate, scanSeeded: false, scanAge: daysAgo(scanDate), bucket,
          closes, days: daysLeft(closes) })
      }
    }
  }
  scanFinds.sort((a, b) => a.scanAge - b.scanAge || (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0))
} catch { /* daily reports optional */ }

const applied = rows.filter(r => ['Applied', 'Responded', 'Interview', 'Offer'].includes(r.status))
const queue = rows.filter(r => r.status === 'Evaluated' && ['PRIORITY', 'APPLY', 'BACKLOG'].includes(r.band))
const priority = queue.filter(r => r.band === 'PRIORITY').sort(sortQueue)
const applyBand = queue.filter(r => r.band === 'APPLY').sort(sortQueue)
const backlog = queue.filter(r => r.band === 'BACKLOG').sort(sortQueue)
const parked = rows.filter(r => !applied.includes(r) && !queue.includes(r))
const dueSoon = queue.filter(r => r.days !== null && r.days <= 7)

function sortQueue(a, b) {
  const ad = a.days === null ? 999 : a.days, bd = b.days === null ? 999 : b.days
  return ad - bd || (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0)
}

// ---- render ------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const outDir = dirname(OUT)
const link = (abs) => abs ? relative(outDir, resolve(ROOT, abs)) : ''

function chip(txt, cls) { return `<span class="chip ${cls}">${esc(txt)}</span>` }
function scanChip(r) {
  if (!r.scan) return ''
  if (r.scanSeeded) return chip('seed ≤' + r.scan.slice(5), 'seed')
  const cls = r.scanAge <= 1 ? 'fresh' : r.scanAge <= 3 ? 'recent' : ''
  return chip('scan ' + r.scan.slice(5), cls)
}
const scanQ = (r) => r.scan ? ' scan ' + r.scan + (r.scanAge <= 1 && !r.scanSeeded ? ' fresh' : '') : ''
function closeCell(r) {
  if (r.days === null) return '<td class="closes">rolling</td>'
  const cls = r.days <= 2 ? 'urgent' : r.days <= 7 ? 'soon' : ''
  return `<td class="closes ${cls}">${esc(r.closes)}<small>${r.days < 0 ? 'closed' : r.days === 0 ? 'today!' : 'in ' + r.days + 'd'}</small></td>`
}
function row(r) {
  const cvHref = SITE_DIR ? 'cv/' + basename(r.cv || '') : link(r.cv)
  const cvCell = r.cv && existsSync(resolve(ROOT, r.cv))
    ? `<a class="btn cv" href="${esc(cvHref)}">CV</a>` : '<span class="nocv">—</span>'
  const applyBtn = r.url ? `<a class="btn go" href="${esc(r.url)}" target="_blank">apply ↗</a>` : ''
  const repHref = SITE_DIR ? 'reports/' + r.num + '.html' : (r.reportAbs ? link(relative(ROOT, r.reportAbs)) : '')
  const reportBtn = r.reportAbs ? `<a class="btn rep" href="${esc(repHref)}">report</a>` : ''
  const actBtns = r.status === 'Evaluated'
    ? `<button class="btn act ok" data-num="${r.num}" data-act="applied" title="record that YOU submitted this application">✓ applied</button><button class="btn act no" data-num="${r.num}" data-act="park" title="not interested — park it">✗ park</button>`
    : ''
  return `<tr data-q="${esc((r.company + ' ' + r.role + ' ' + r.family + ' ' + r.band + ' ' + r.status + scanQ(r)).toLowerCase())}">
    <td class="num">${r.num}</td>
    <td class="score s${Math.floor(parseFloat(r.score) || 0)}">${esc(r.score)}</td>
    <td>${chip(r.family || '·', 'fam')} ${chip(r.lang, 'lang')} ${scanChip(r)}</td>
    <td class="role"><b>${esc(r.company)}</b><br>${esc(r.role)}</td>
    ${closeCell(r)}
    <td class="actions">${applyBtn} ${cvCell} ${reportBtn}${actBtns ? '<br>' + actBtns : ''}</td>
    <td class="notes">${esc(r.notes)}</td>
  </tr>`
}
function section(title, list, open = true) {
  if (!list.length) return ''
  return `<details ${open ? 'open' : ''}><summary>${title} <span class="count">${list.length}</span></summary>
  <table><thead><tr><th>#</th><th>score</th><th></th><th>role</th><th>closes</th><th>actions</th><th>notes</th></tr></thead>
  <tbody>${list.map(row).join('\n')}</tbody></table></details>`
}
function findRow(x) {
  return `<tr data-q="${esc((x.company + ' ' + x.title + ' ' + x.family + ' ' + x.bucket + ' unevaluated' + scanQ(x)).toLowerCase())}">
    <td class="score s${Math.floor(parseFloat(x.score) || 0)}">${esc(x.score)}</td>
    <td>${chip(x.family, 'fam')} ${chip(x.lang, 'lang')} ${scanChip(x)} ${chip(x.bucket, x.bucket === 'PRIORITY' ? 'prio' : '')}</td>
    <td class="role"><b>${esc(x.company)}</b><br>${esc(x.title)}</td>
    ${closeCell(x)}
    <td class="actions"><a class="btn go" href="${esc(x.url)}" target="_blank">view ↗</a></td>
  </tr>`
}
function findsSection() {
  if (!scanFinds.length) return '<p style="color:var(--dim);padding:8px 4px">No unevaluated finds — every PRIORITY/APPLY row from the recent scans has a tracker row. New scan results appear here before evaluation.</p>'
  return `<details open><summary>🛰 New from scans — not yet evaluated <span class="count">${scanFinds.length}</span></summary>
  <table><thead><tr><th>triage</th><th></th><th>role</th><th>closes</th><th>actions</th></tr></thead>
  <tbody>${scanFinds.map(findRow).join('\n')}</tbody></table></details>`
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
let lastScan = ''
try {
  const tsvs = readdirSync(resolve(ROOT, 'data/new')).filter(f => /^\d{4}-\d{2}-\d{2}\.tsv$/.test(f)).sort()
  if (tsvs.length) {
    const f = tsvs[tsvs.length - 1]
    const n = readFileSync(resolve(ROOT, 'data/new', f), 'utf8').trim().split('\n').length - 1
    lastScan = ` · last scan <b>${f.slice(0, 10)}</b> (+${n} new)`
  }
} catch { /* no scan outputs yet */ }
const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dk-job-ops — pipeline</title><style>
  :root { --teal:#0f9b8e; --bg:#101418; --card:#1a2027; --txt:#e8edf2; --dim:#8b97a3; }
  * { box-sizing:border-box } body { background:var(--bg); color:var(--txt); margin:0;
    font:14px/1.45 -apple-system,'Segoe UI',Roboto,sans-serif; padding:18px; }
  h1 { font-size:19px; margin:0 0 4px } h1 b{color:var(--teal)} .sub{color:var(--dim);font-size:12px;margin-bottom:14px}
  .stats { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px }
  .stat { background:var(--card); border-radius:10px; padding:8px 14px; text-align:center }
  .stat b { display:block; font-size:20px; color:var(--teal) } .stat span{font-size:11px;color:var(--dim)}
  input#q { width:100%; padding:9px 12px; border-radius:10px; border:1px solid #2a323c;
    background:var(--card); color:var(--txt); margin-bottom:14px; font-size:14px }
  details { background:var(--card); border-radius:12px; margin-bottom:12px; padding:4px 10px }
  summary { cursor:pointer; font-weight:600; padding:8px 4px; font-size:15px }
  .count { color:var(--dim); font-weight:400 }
  table { width:100%; border-collapse:collapse; font-size:13px }
  th { text-align:left; color:var(--dim); font-weight:500; font-size:11px; padding:4px 6px }
  td { padding:7px 6px; border-top:1px solid #242c35; vertical-align:top }
  .num { color:var(--dim) } .role { min-width:180px }
  .score { font-weight:700 } .s4,.s5 { color:#37d4a0 } .s3 { color:#e9c46a } .s2,.s1,.s0 { color:var(--dim) }
  .chip { display:inline-block; padding:1px 7px; border-radius:99px; font-size:10.5px; background:#242c35; color:var(--dim) }
  .chip.fresh { background:#103b32; color:#37d4a0; font-weight:600 }
  .chip.recent { background:#3a3322; color:#e9c46a }
  .chip.seed { background:transparent; border:1px dashed #2a323c }
  .chip.prio { background:#3b1f1a; color:#ef9a8a }
  .closes small { display:block; color:var(--dim); font-size:10.5px }
  .closes.soon small { color:#e9c46a } .closes.urgent small { color:#ef6a5a; font-weight:700 }
  .btn { display:inline-block; padding:3px 10px; border-radius:8px; font-size:11.5px; text-decoration:none; margin:1px 2px 1px 0 }
  .btn.go { background:var(--teal); color:#04211d; font-weight:600 } .btn.cv { background:#2b3a44; color:var(--txt) }
  .btn.rep { background:transparent; border:1px solid #2a323c; color:var(--dim) }
  .nocv { color:#39424c } .notes { color:var(--dim); font-size:11.5px; max-width:340px }
  .actions { white-space:nowrap }
  .tabs { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap }
  .tabbtn { background:var(--card); color:var(--dim); border:1px solid #2a323c; border-radius:10px;
    padding:8px 16px; font:600 13.5px inherit; cursor:pointer }
  .tabbtn.on { background:var(--teal); color:#04211d; border-color:var(--teal) }
  .tabbtn .count { font-weight:400; opacity:.75; margin-left:4px }
  .tab { display:none } .tab.on { display:block }
  button.act { border:none; cursor:pointer; font:inherit; font-size:11.5px }
  .act.ok { background:#1d3a2b; color:#37d4a0 } .act.no { background:#3a2424; color:#ef9a8a }
  .act[disabled] { opacity:.4; cursor:wait }
  #gear { position:absolute; top:18px; right:18px; background:none; border:none; font-size:17px; cursor:pointer; opacity:.6 }
  #toast { position:fixed; bottom:18px; left:50%; transform:translateX(-50%); background:#26313c; color:var(--txt);
    padding:10px 18px; border-radius:99px; font-size:13px; display:none; z-index:9; box-shadow:0 4px 18px #0008 }
  @media (max-width:700px){ .notes{display:none} th:last-child{display:none} }
</style></head><body>
<button id="gear" title="GitHub token for the ✓/✗ buttons">⚙</button>
<h1>dk-job-<b>ops</b> — Denmark pipeline</h1>
<div class="sub">generated ${stamp} UTC · ${rows.length} tracked${lastScan} · regenerate: <code>node dashboard.mjs</code></div>
<div class="stats">
  <div class="stat"><b>${applied.length}</b><span>applied</span></div>
  <div class="stat"><b>${priority.length}</b><span>priority queue</span></div>
  <div class="stat"><b>${applyBand.length}</b><span>apply band</span></div>
  <div class="stat"><b>${dueSoon.length}</b><span>due ≤7d</span></div>
  <div class="stat"><b>${scanFinds.length}</b><span>uneval'd finds</span></div>
  <div class="stat"><b>${parked.length}</b><span>parked</span></div>
</div>
<input id="q" placeholder="filter… (company, role, family, band, scan 06-12, fresh)" oninput="
  const v=this.value.toLowerCase();
  document.querySelectorAll('tbody tr').forEach(t=>t.style.display=t.dataset.q.includes(v)?'':'none')">
<nav class="tabs">
  <button class="tabbtn" data-tab="queue">⭐ Queue<span class="count">${priority.length + applyBand.length + backlog.length}</span></button>
  <button class="tabbtn" data-tab="finds">🛰 Finds<span class="count">${scanFinds.length}</span></button>
  <button class="tabbtn" data-tab="applied">✉️ Applied<span class="count">${applied.length}</span></button>
  <button class="tabbtn" data-tab="parked">🗄 Parked<span class="count">${parked.length}</span></button>
</nav>
<div class="tab" id="tab-queue">
${section('🔥 Closing within 7 days', dueSoon)}
${section('⭐ PRIORITY queue', priority)}
${section('📋 APPLY band', applyBand)}
${section('🅿️ Backlog', backlog, false)}
</div>
<div class="tab" id="tab-finds">
${findsSection()}
</div>
<div class="tab" id="tab-applied">
${section('✉️ Applied / in play', applied)}
</div>
<div class="tab" id="tab-parked">
${section('🗄 Parked (discarded / skip / dead)', parked)}
</div>
<div id="toast"></div>
<script>
const REPO = '{{GITHUB_OWNER}}/dk-job-ops', WF = 'tracker-update.yml'
const TABS = ['queue', 'finds', 'applied', 'parked']
function showTab(id) {
  if (!TABS.includes(id)) id = 'queue'
  document.querySelectorAll('.tab').forEach(d => d.classList.toggle('on', d.id === 'tab-' + id))
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('on', b.dataset.tab === id))
  history.replaceState(null, '', '#' + id)
}
document.querySelectorAll('.tabbtn').forEach(b => b.onclick = () => showTab(b.dataset.tab))
showTab((location.hash || '#queue').slice(1))

let toastT
function toast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg; t.style.display = 'block'
  clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 6000)
}
const pat = () => localStorage.getItem('dkjobops_pat') || ''
document.getElementById('gear').onclick = () => {
  const t = prompt('GitHub fine-grained PAT for ' + REPO + ' (permission: Actions → Read and write). Stored only in this browser. Leave empty to clear.', pat())
  if (t !== null) { t ? localStorage.setItem('dkjobops_pat', t) : localStorage.removeItem('dkjobops_pat'); toast(t ? 'token saved' : 'token cleared') }
}
async function dispatch(num, act, btn) {
  if (!pat()) { document.getElementById('gear').click(); if (!pat()) return }
  btn.disabled = true
  try {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/actions/workflows/' + WF + '/dispatches', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + pat(), Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: 'main', inputs: { num, action: act } }),
    })
    if (r.status === 204) {
      const tr = btn.closest('tr')
      tr.style.opacity = .45
      tr.querySelectorAll('.act').forEach(b => b.remove())
      toast('#' + num + ' → ' + act + ' queued — tracker updates and site redeploys in ~2 min')
    } else {
      btn.disabled = false
      toast('failed: HTTP ' + r.status + (r.status === 401 || r.status === 403 ? ' — check the token (⚙)' : r.status === 404 ? ' — workflow not on main yet?' : ''))
    }
  } catch (e) { btn.disabled = false; toast('network error: ' + e.message) }
}
document.body.addEventListener('click', e => {
  const b = e.target.closest('button.act')
  if (b) dispatch(b.dataset.num, b.dataset.act, b)
})
</script>
</body></html>`

writeFileSync(OUT, html)
console.log(`dashboard: ${OUT}`)
console.log(`rows: ${rows.length} | applied ${applied.length} · priority ${priority.length} · apply ${applyBand.length} · due-soon ${dueSoon.length} · parked ${parked.length}`)

// ---- site mode: report pages, artifacts, robots --------------------------------
if (SITE_DIR) {
  const REPORT_CSS = `body{background:#101418;color:#e8edf2;font:15px/1.6 -apple-system,'Segoe UI',Roboto,sans-serif;
    max-width:780px;margin:0 auto;padding:24px 18px} a{color:#0f9b8e} h1,h2{line-height:1.3}
    table{border-collapse:collapse;width:100%;font-size:13px} th,td{border:1px solid #2a323c;padding:6px 8px;text-align:left}
    code,pre{background:#1a2027;border-radius:6px;padding:2px 5px} pre{padding:12px;overflow-x:auto}
    blockquote{border-left:3px solid #0f9b8e;margin-left:0;padding-left:14px;color:#8b97a3}
    .back{display:inline-block;margin-bottom:14px;font-size:13px}`
  let nReports = 0
  for (const r of rows) {
    if (!r.reportAbs || !existsSync(r.reportAbs)) continue
    const md = readFileSync(r.reportAbs, 'utf8')
    const body = marked.parse(md)
    writeFileSync(resolve(SITE_DIR, 'reports', r.num + '.html'),
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>#${r.num} ${esc(r.company)}</title><style>${REPORT_CSS}</style></head><body><a class="back" href="../index.html">← dashboard</a>${body}</body></html>`)
    nReports++
  }
  let nFiles = 0
  const outDirAbs = resolve(ROOT, 'output')
  for (const f of readdirSync(outDirAbs)) {
    if (f.endsWith('.pdf') || f.startsWith('pismo-')) { copyFileSync(resolve(outDirAbs, f), resolve(SITE_DIR, 'cv', f)); nFiles++ }
  }
  writeFileSync(resolve(SITE_DIR, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  console.log(`site: ${SITE_DIR} | ${nReports} report pages · ${nFiles} artifacts · robots.txt`)
}
