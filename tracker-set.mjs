#!/usr/bin/env node
// tracker-set.mjs — single-row status update for data/applications.md.
// The dashboard's ✓/✗ buttons dispatch tracker-update.yml, which runs this.
//
//   node tracker-set.mjs <###> <applied|park>
//
//   applied → status Applied   (the user states he submitted it himself)
//   park    → status Discarded (user pass — not interested)

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const [num, action] = process.argv.slice(2)
if (!/^\d{3}$/.test(num || '') || !['applied', 'park'].includes(action || '')) {
  console.error('usage: node tracker-set.mjs <###> <applied|park>')
  process.exit(2)
}

const today = new Date().toISOString().slice(0, 10)
const target = {
  applied: { status: 'Applied', note: `→ Applied ${today} (dashboard)` },
  park: { status: 'Discarded', note: `→ USER PASS ${today} (dashboard)` },
}[action]

const path = resolve(ROOT, 'data/applications.md')
const lines = readFileSync(path, 'utf8').split('\n')
const i = lines.findIndex((l) => l.startsWith(`| ${num} |`))
if (i < 0) { console.error(`row ${num} not found in data/applications.md`); process.exit(1) }

// | # | Date | Company | Role | Lang | Closes | Score | Status | PDF | Report | Notes |
const m = lines[i].match(/^(\| \d{3} \|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|)([^|]*)(\|[^|]*\|[^|]*\|)(.*)\|\s*$/)
if (!m) { console.error(`row ${num} did not match the tracker format`); process.exit(1) }

const current = m[2].trim()
if (current === target.status) { console.log(`row ${num} already ${current} — nothing to do`); process.exit(0) }
if (['Responded', 'Interview', 'Offer'].includes(current)) {
  console.error(`row ${num} is ${current} — refusing to overwrite an in-play status from the dashboard`)
  process.exit(1)
}

lines[i] = `${m[1]} ${target.status} ${m[3]}${m[4].trimEnd()} ${target.note} |`
writeFileSync(path, lines.join('\n'))
console.log(`row ${num}: ${current} → ${target.status}`)
