// Minimal Markdown table extraction from the repository's SDLC documents.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)) // repository root

export const clean = (s) => s
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1').replace(/\\\|/g, '|').trim()

function splitRow(line) {
  const cells = []; let cur = ''
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue }
    if (line[i] === '|') { cells.push(cur); cur = ''; continue }
    cur += line[i]
  }
  cells.push(cur)
  return cells.slice(1, -1).map(clean)
}

/** Returns every table (head + rows) found after the heading line that contains `heading`, until the next heading of the same or higher level. */
export function tablesAfter(file, heading, { all = false } = {}) {
  const lines = readFileSync(ROOT + file, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => /^#+ /.test(l) && l.includes(heading))
  if (start < 0) throw new Error(`heading not found: ${heading} in ${file}`)
  const level = lines[start].match(/^#+/)[0].length
  const tables = []; let cur = null
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    const m = l.match(/^(#+) /)
    if (m && m[1].length <= level) break
    if (l.trim().startsWith('|')) {
      if (!cur) {
        const hasSep = /^\|\s*:?-{3,}/.test((lines[i + 1] ?? '').trim())
        if (!hasSep && tables.length) { cur = tables.pop(); cur.rows.push(splitRow(l.trim())); continue } // continuation after a blank line
        cur = { head: splitRow(l.trim()), rows: [] }; if (hasSep) i++; continue
      }
      cur.rows.push(splitRow(l.trim()))
    } else if (cur) { tables.push(cur); cur = null; if (!all && l.trim() !== '') break }
  }
  if (cur) tables.push(cur)
  return all ? tables : tables[0]
}

/** Every table under subheadings of a section, with the subheading as title. */
export function titledTables(file, heading) {
  const lines = readFileSync(ROOT + file, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((l) => /^#+ /.test(l) && l.includes(heading))
  const level = lines[start].match(/^#+/)[0].length
  const out = []; let title = null; let cur = null
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]; const m = l.match(/^(#+) (.*)/)
    if (m && m[1].length <= level) break
    if (m) { title = clean(m[2]); continue }
    if (l.trim().startsWith('|')) {
      if (!cur) { cur = { title, head: splitRow(l.trim()), rows: [] }; i++; continue }
      cur.rows.push(splitRow(l.trim()))
    } else if (cur) { out.push(cur); cur = null }
  }
  if (cur) out.push(cur)
  return out
}
