#!/usr/bin/env node
// jd-extract.mjs — strip a fetched job posting (raw HTML or ATS JSON) down to plain text
// so agents read a few KB of text instead of a full page dump.
//
//   node jd-extract.mjs <type> <inputFile> <outputFile> [jobId]
//
//   type: workday | smartrecruiters | ashby | html
//   exit 0 = text written; exit 2 = posting structurally gone (prints DEAD + reason)
//
// Liveness caveat: exit 0 only means the source HAD content — for `html` sources the
// caller must still grep the OUTPUT text for closed-ad markers (deaktiviran, istekao,
// zatvoren, "no longer accepting applications").

import { readFileSync, writeFileSync } from 'fs'
// cheerio/slim, not cheerio — the main entry needs Node 20's File global (see providers/_html.mjs)
import { load } from 'cheerio/slim'

const [type, inFile, outFile, jobId] = process.argv.slice(2)
if (!type || !inFile || !outFile) {
  console.error('usage: node jd-extract.mjs <workday|smartrecruiters|ashby|html> <in> <out> [jobId]')
  process.exit(1)
}

const dead = (reason) => { console.log('DEAD: ' + reason); process.exit(2) }
const clean = (s) => s.replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim()
const stripHtml = (html) => {
  const $ = load(html || '')
  $('script,style,noscript,iframe,svg').remove()
  return $.root().text()
}

const raw = readFileSync(inFile, 'utf8')
let text = ''

if (type === 'workday') {
  let j; try { j = JSON.parse(raw) } catch { dead('not JSON — posting likely removed') }
  const i = j.jobPostingInfo
  if (!i) dead('no jobPostingInfo in CXS response')
  text = [i.title, i.location || '', 'posted: ' + (i.postedOn || ''), 'end date: ' + (i.endDate || ''),
    'time type: ' + (i.timeType || ''), '', stripHtml(i.jobDescription)].join('\n')
} else if (type === 'smartrecruiters') {
  let j; try { j = JSON.parse(raw) } catch { dead('not JSON — posting likely removed') }
  if (!j.name || j.message) dead('API error: ' + (j.message || 'no posting name'))
  const s = j.jobAd && j.jobAd.sections ? j.jobAd.sections : {}
  text = [j.name, (j.location && (j.location.city + ', ' + j.location.country)) || '',
    'released: ' + (j.releasedDate || ''), 'employment: ' + ((j.typeOfEmployment && j.typeOfEmployment.label) || ''), '']
    .concat(['companyDescription', 'jobDescription', 'qualifications', 'additionalInformation']
      .map(k => s[k] ? stripHtml(s[k].text) : '')).join('\n')
} else if (type === 'ashby') {
  let j; try { j = JSON.parse(raw) } catch { dead('not JSON') }
  const jobs = j.jobs || []
  const job = jobs.find(x => x.id === jobId || (x.jobUrl && jobId && x.jobUrl.includes(jobId)))
  if (!job) dead('job id ' + jobId + ' not on the board (' + jobs.length + ' live postings)')
  text = [job.title, job.location || '', 'employment: ' + (job.employmentType || ''), '',
    stripHtml(job.descriptionHtml)].join('\n')
} else if (type === 'html') {
  const $ = load(raw)
  $('script,style,noscript,iframe,svg,nav,footer').remove()
  text = $('body').text()
} else {
  console.error('unknown type: ' + type)
  process.exit(1)
}

text = clean(text)
if (text.length < 200) dead('extracted text suspiciously short (' + text.length + ' chars) — page is likely a stub/removed')
writeFileSync(outFile, text + '\n')
console.log('OK ' + outFile + ' (' + text.length + ' chars)')
