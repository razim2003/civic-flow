// Builds the editable Word version from the same content model.
// Page breaks follow the PDF (out/layout.json from build-pdf.mjs), so both versions have the same page numbers,
// and the contents, figure and table lists are written out in full (as Word fields that can still be updated).
import { readFileSync, writeFileSync } from 'node:fs'
import JSZip from 'jszip'
import {
  AlignmentType, Bookmark, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, InternalHyperlink, LeaderType, LevelFormat,
  LineRuleType, PageBreak, TableLayoutType, PageNumber, PageOrientation, Packer, Paragraph, ShadingType, Tab, Table, TableCell, TableRow, TabStopType,
  TextRun, VerticalAlign, WidthType,
} from 'docx'
import { prepare, fitFigure, figPath, meta } from './prepare.mjs'

const OUT = process.argv[2] ?? 'out/CivicFlow_Group15_Project_Report.docx'
const { blocks, toc, figures, tables } = prepare()
const GREEN = '1F5C4A', ORANGE = 'D9531E', INK = '1D2622', MUTED = '5C6862'
const PW = 9638, LW = 14798 // usable widths in DXA (A4, 2 cm / 1.8 cm margins), the same as the PDF
const PORTRAIT = [642, 930], LANDSCAPE = [975, 600] // figure boxes in px, the same as the PDF
const FONT = 'Calibri'

// ---------- pagination taken from the PDF ----------
const { markers } = JSON.parse(readFileSync('out/layout.json', 'utf8'))
let page = 0, freshNext = false
/** Returns true when the unit must start a new page. `fresh` units already start one (chapter, title, new section). */
function brk(key, fresh = false) {
  const p = markers[key]
  if (p === undefined) throw new Error(`no page marker ${key}; run build-pdf.mjs first`)
  if (fresh || freshNext) {
    if (p !== page + 1) throw new Error(`${key} should start page ${page + 1} but the PDF has it on page ${p}`)
    freshNext = false; page = p; return false
  }
  if (p === page) return false
  if (p !== page + 1) throw new Error(`${key}: page ${page} is followed by page ${p}`)
  page = p
  return true
}

const anchorOf = (label) => `_Toc_${label.replace(/^Figure /, 'fig_').replace(/^Table /, 'tab_').replace(/[^A-Za-z0-9]/g, '_')}`
const runs = (text, opts = {}) => String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
  part.startsWith('**') ? new TextRun({ text: part.slice(2, -2), bold: true, ...opts }) : new TextRun({ text: part, ...opts }))
// Exact line heights, slightly tighter than the PDF's CSS, so a Word page never holds more than its PDF page.
const EXACT = LineRuleType.EXACT
const para = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 100, line: 316, lineRule: EXACT }, alignment: AlignmentType.JUSTIFIED, ...opts })
const pageBreakPara = () => new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [new PageBreak()] })

let listInstance = 0
function table(b, width, k) {
  const ws = b.widths ?? b.head.map(() => 1), total = ws.reduce((a, c) => a + c, 0)
  const cols = ws.map((w) => Math.floor((w / total) * width))
  cols[cols.length - 1] += width - cols.reduce((a, c) => a + c, 0)
  const size = b.tiny ? 15 : b.small ? 17 : 19, line = b.tiny ? 210 : b.small ? 230 : 250
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D5DAD6' }
  const borders = { top: border, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }
  const riskFill = (v) => { const n = parseInt(v, 10); return isNaN(n) ? null : n >= 6 ? 'F8D7D1' : n >= 4 ? 'FDEBC8' : 'D8EEE2' }
  const cell = (text, i, header, zebra) => {
    const risk = b.risk && !header && (i === 5 || i === 7) ? riskFill(text) : null
    return new TableCell({
      width: { size: cols[i], type: WidthType.DXA }, borders,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: header ? GREEN : risk ?? (zebra ? 'F4F7F5' : 'FFFFFF') },
      margins: { top: 50, bottom: 50, left: 80, right: 80 }, verticalAlign: header ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
      children: [new Paragraph({ alignment: risk ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: 0, line, lineRule: EXACT }, children: runs(text, { size, bold: header || !!risk, color: header ? 'FFFFFF' : INK, font: FONT }) })],
    })
  }
  const headRow = () => new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => cell(h, i, true)) })
  // Split the table where the PDF starts a new page, repeating the header row.
  const parts = [[]]
  b.rows.forEach((r, ri) => {
    if (brk(`R${k}.${ri}`)) {
      if (!parts.at(-1).length) throw new Error(`${b.label}: caption and first row are on different pages`)
      parts.push([])
    }
    parts.at(-1).push(ri)
  })
  const out = []
  parts.forEach((idx, n) => {
    if (n) out.push(pageBreakPara())
    out.push(new Table({ width: { size: width, type: WidthType.DXA }, columnWidths: cols, layout: TableLayoutType.FIXED, rows: [headRow(), ...idx.map((ri) => new TableRow({ cantSplit: true, children: b.rows[ri].map((c, i) => cell(c, i, false, ri % 2 === 1)) }))] }))
  })
  return out
}
function tableBlock(b, width, k) {
  const caption = new Paragraph({ style: 'TableCaption', pageBreakBefore: brk(`B${k}`), keepNext: true, spacing: { before: 160, after: 60, line: 260, lineRule: EXACT },
    children: [new Bookmark({ id: anchorOf(b.label), children: [new TextRun({ text: `${b.label}: `, bold: true, size: 18, color: INK }), new TextRun({ text: b.caption, size: 18, color: MUTED })] })] })
  return [caption, ...table(b, width, k), new Paragraph({ spacing: { before: 0, after: 0, line: 160, lineRule: EXACT }, children: [] })]
}

function figure(b, k) {
  const [bw, bh] = b.landscape ? LANDSCAPE : PORTRAIT
  const { w, h } = fitFigure(b, bw, bh * 0.96) // a little smaller than the PDF: Word adds the line descent below a picture
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: brk(`B${k}`), keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: 'png', data: readFileSync(figPath(b.src)), transformation: { width: w, height: h }, altText: { title: b.label, description: b.caption, name: b.src } })] }),
    new Paragraph({ style: 'FigureCaption', alignment: AlignmentType.CENTER, spacing: { after: 200, line: 260, lineRule: EXACT },
      children: [new Bookmark({ id: anchorOf(b.label), children: [new TextRun({ text: `${b.label}: `, bold: true, size: 18, color: INK }), new TextRun({ text: b.caption, size: 18, color: MUTED })] })] }),
  ]
}

const callout = (title, text, k) => {
  const opts = { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FDF3EE' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: ORANGE, space: 8 } }, indent: { left: 160, right: 160 } }
  return [new Paragraph({ ...opts, pageBreakBefore: brk(`B${k}`), keepNext: true, spacing: { before: 120, after: 0, line: 316, lineRule: EXACT }, children: [new TextRun({ text: title, bold: true, color: 'A63C12' })] }),
    new Paragraph({ ...opts, spacing: { after: 200, line: 316, lineRule: EXACT }, alignment: AlignmentType.JUSTIFIED, children: runs(text) })]
}

function cover() {
  const img = figPath('shot-landing'), { w, h } = fitFigure({ src: 'shot-landing', size: { w: 1284, h: 814 }, w: 0.95 }, 642, 900)
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const memberRows = meta.members.map(([id, n]) => new TableRow({ children: [id, n].map((t, i) => new TableCell({ width: { size: i ? 3200 : 1800, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: t, size: 21 })] })] })) }))
  return [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: meta.university.toUpperCase(), bold: true, color: GREEN, size: 22, characterSpacing: 40 })] }),
    new Paragraph({ spacing: { after: 900 }, children: [new TextRun({ text: 'ICT2232 Software Engineering · Mini Project', color: MUTED, size: 21 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'Civic', bold: true, size: 96, color: INK }), new TextRun({ text: 'Flow', bold: true, size: 96, color: ORANGE })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: meta.subtitle, bold: true, size: 36, color: GREEN })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 4 } }, spacing: { after: 360 }, children: [new TextRun({ text: `Final Project Report · SDLC documentation · ${meta.group}`, size: 24, color: MUTED })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [new ImageRun({ type: 'png', data: readFileSync(img), transformation: { width: w, height: h }, altText: { title: 'CivicFlow', description: 'CivicFlow landing page', name: 'cover' } })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'GROUP 15 MEMBERS', bold: true, color: GREEN, size: 19, characterSpacing: 30 })] }),
    new Table({ width: { size: 5000, type: WidthType.DXA }, columnWidths: [1800, 3200], rows: memberRows }),
    new Paragraph({ spacing: { before: 240, after: 40 }, children: [new TextRun({ text: 'SUBMISSION', bold: true, color: GREEN, size: 19, characterSpacing: 30 })] }),
    ...[`Lecturer: ${meta.lecturer}`, `Date: ${meta.date}`, `Live system: ${meta.url}`, `Repository: ${meta.repo}`].map((t) => new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: t, size: 21 })] })),
  ]
}

// ---------- contents, list of figures, list of tables ----------
// Entries are written out with their page numbers (PAGEREF fields) inside a TOC field, so they show in every viewer
// and Word can still refresh them. §…§ placeholders are turned into field codes after packing.
const TOC_FIELDS = ['TOC \\o "1-2" \\h \\z', 'TOC \\h \\z \\t "FigureCaption,9"', 'TOC \\h \\z \\t "TableCaption,9"']
const dots = { type: TabStopType.RIGHT, position: PW, leader: LeaderType.DOT }
function tocList(n, entries) {
  return entries.map((e, i) => new Paragraph({
    style: e.style, pageBreakBefore: brk(e.key), tabStops: [...e.tabs, dots],
    children: [
      ...(i === 0 ? [new TextRun(`§TB§${n}§`)] : []),
      new InternalHyperlink({ anchor: e.anchor, children: [new TextRun(e.num), new TextRun({ children: [new Tab()] }), new TextRun(e.text), new TextRun({ children: [new Tab()] }), new TextRun(`§PG§${e.anchor}§${e.page}§`)] }),
      ...(i === entries.length - 1 ? [new TextRun('§TE§')] : []),
    ],
  }))
}
const tocTitle = (text, key) => { brk(key, true); return new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: true, children: [new TextRun(text)] }) }
const pageOfBlock = (pred) => markers[`B${blocks.findIndex(pred)}`]

const header = (width) => new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D5DAD6', space: 4 } }, children: [new TextRun({ text: 'CivicFlow – Public Service Complaint & Resolution System', size: 15, color: '7A857F' }), new TextRun({ text: '\tICT2232 · Group 15', size: 15, color: '7A857F' })] })] })
const footer = (width) => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], children: [new TextRun({ text: 'Final project report', size: 16, color: '7A857F' }), new TextRun({ children: ['\tPage ', PageNumber.CURRENT], size: 16, color: '7A857F' })] })] })
const props = (land, first) => ({
  page: { size: { width: 11906, height: 16838, orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
    margin: land ? { top: 1134, bottom: 1020, left: 1020, right: 1020 } : { top: 1361, bottom: 1134, left: 1134, right: 1134 },
    ...(first ? { pageNumbers: { start: 1 } } : {}) },
})

// ---------- body ----------
const sections = []
let children = [], land = false, firstBody = true
const flush = () => {
  if (!children.length) return
  const width = land ? LW : PW
  sections.push({ properties: props(land, firstBody), headers: { default: header(width) }, footers: { default: footer(width) }, children })
  children = []; firstBody = false; freshNext = true
}
const headingRuns = (b, color) => [new TextRun({ text: b.num, color }), new TextRun({ children: [new Tab()] }), new TextRun(b.text)]
for (const [k, b] of blocks.entries()) {
  const width = land ? LW : PW
  switch (b.t) {
    case 'cover': sections.push({ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } }, children: cover() }); freshNext = true; break
    case 'front': brk(`B${k}`, true); children.push(new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: children.length > 0, children: [new TextRun(b.title)] }), ...b.paras.map((p) => para(p))); break
    case 'toc': {
      children.push(tocTitle('Table of contents', 'X0'), ...tocList(0, toc.map((e, i) => ({
        key: `T${i}`, style: e.level === 1 ? 'TOC1' : 'TOC2', tabs: [{ type: TabStopType.LEFT, position: e.level === 1 ? 624 : 1190 }],
        num: e.num, text: e.text, anchor: `_Toc_h_${e.num.replace(/\./g, '_')}`, page: pageOfBlock((x) => x.id === e.id),
      }))))
      children.push(tocTitle('List of figures', 'X1'), ...tocList(1, figures.map((f, i) => ({ key: `F${i}`, style: 'TOC9', tabs: [], num: `${f.label}:`, text: f.text, anchor: anchorOf(f.label), page: pageOfBlock((x) => x.label === f.label) }))))
      children.push(tocTitle('List of tables', 'X2'), ...tocList(2, tables.map((f, i) => ({ key: `L${i}`, style: 'TOC9', tabs: [], num: `${f.label}:`, text: f.text, anchor: anchorOf(f.label), page: pageOfBlock((x) => x.label === f.label) }))))
      break
    }
    case 'landscape': flush(); land = true; break
    case 'portrait': flush(); land = false; break
    case 'h1': brk(`B${k}`, true); children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: children.length > 0, tabStops: [{ type: TabStopType.LEFT, position: 680 }], children: [new Bookmark({ id: `_Toc_h_${b.num}`, children: headingRuns(b, ORANGE) })] })); break
    case 'h2': children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: brk(`B${k}`), tabStops: [{ type: TabStopType.LEFT, position: 800 }], children: [new Bookmark({ id: `_Toc_h_${b.num.replace(/\./g, '_')}`, children: headingRuns(b, '6B7A73') })] })); break
    case 'h3': children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, pageBreakBefore: brk(`B${k}`), children: [new TextRun({ text: `${b.num}  `, color: '6B7A73' }), new TextRun(b.text)] })); break
    case 'p': children.push(para(b.text, { pageBreakBefore: brk(`B${k}`) })); break
    case 'bullets': children.push(...b.items.map((i, n) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, pageBreakBefore: brk(`I${k}.${n}`), spacing: { after: 60, line: 300, lineRule: EXACT }, children: runs(i) }))); break
    case 'numbers': case 'refs': { const inst = ++listInstance; children.push(...b.items.map((i, n) => new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: inst }, pageBreakBefore: brk(`I${k}.${n}`), spacing: { after: 80, line: 300, lineRule: EXACT }, children: runs(i) }))); break }
    case 'callout': children.push(...callout(b.title, b.text, k)); break
    case 'table': children.push(...tableBlock(b, width, k)); break
    case 'fig': children.push(...figure(b, k)); break
  }
}
flush()

const tocStyle = (id, name, run, indent, before, line = 284) => ({ id, name, basedOn: 'Normal', next: 'Normal', run: { font: FONT, ...run }, paragraph: { spacing: { before, after: 0, line, lineRule: EXACT }, indent: { ...indent, right: 560 } } })
const doc = new Document({
  creator: 'Group 15', title: 'CivicFlow – Final Project Report', description: 'ICT2232 Software Engineering mini project report',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 40, bold: true, color: INK }, paragraph: { spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 4 } } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 40, bold: true, color: INK }, paragraph: { spacing: { after: 240 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: GREEN }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
      { id: 'FigureCaption', name: 'FigureCaption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 18 } },
      { id: 'TableCaption', name: 'TableCaption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 18 } },
      tocStyle('TOC1', 'toc 1', { size: 21, bold: true }, { left: 624, hanging: 624 }, 110),
      tocStyle('TOC2', 'toc 2', { size: 20 }, { left: 1190, hanging: 680 }, 0),
      tocStyle('TOC9', 'toc 9', { size: 19 }, { left: 1360, hanging: 1360 }, 0, 264),
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 280 } } } }] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 360 } } } }] },
  ] },
  sections,
})

// ---------- turn the placeholders into Word fields ----------
const zip = await JSZip.loadAsync(await Packer.toBuffer(doc))
let xml = await zip.file('word/document.xml').async('string')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const fld = (rpr, type) => `<w:r>${rpr}<w:fldChar w:fldCharType="${type}"/></w:r>`
const instr = (rpr, text) => `<w:r>${rpr}<w:instrText xml:space="preserve"> ${esc(text)} </w:instrText></w:r>`
const count = { PG: 0, TB: 0, TE: 0 }
// A run is <w:r>[<w:rPr>…</w:rPr>]<w:t …>§…§</w:t></w:r>
xml = xml.replace(/<w:r>(<w:rPr>(?:(?!<\/w:rPr>).)*<\/w:rPr>)?<w:t[^>]*>§(PG|TB|TE)§(?:([^§<]*)§)?(?:(\d+)§)?<\/w:t><\/w:r>/g, (_, rpr = '', kind, a, b) => {
  count[kind]++
  if (kind === 'PG') return fld(rpr, 'begin') + instr(rpr, `PAGEREF ${a} \\h`) + fld(rpr, 'separate') + `<w:r>${rpr}<w:t>${b}</w:t></w:r>` + fld(rpr, 'end')
  if (kind === 'TB') return fld('', 'begin') + instr('', TOC_FIELDS[Number(a)]) + fld('', 'separate')
  return fld('', 'end')
})
const expected = toc.length + figures.length + tables.length
if (count.PG !== expected || count.TB !== 3 || count.TE !== 3 || /§(PG|TB|TE)§/.test(xml)) throw new Error(`field conversion failed: ${JSON.stringify(count)}, expected ${expected} page references`)
const bookmarks = new Set([...xml.matchAll(/<w:bookmarkStart [^>]*w:name="([^"]+)"/g)].map((m) => m[1]))
const missing = [...xml.matchAll(/PAGEREF (\S+) /g)].map((m) => m[1]).filter((a) => !bookmarks.has(a))
if (missing.length) throw new Error(`contents entries without a target: ${missing.join(', ')}`)
zip.file('word/document.xml', xml)
writeFileSync(OUT, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('written', OUT, `${sections.length} sections, ${page} numbered pages (PDF: ${Math.max(...Object.values(markers))}), ${count.PG} contents entries`)
