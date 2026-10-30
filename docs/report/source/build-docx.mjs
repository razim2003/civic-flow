// Builds the editable Word version from the same content model.
import { readFileSync, writeFileSync } from 'node:fs'
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, PageBreak, PageNumber, PageOrientation,
  Packer, Paragraph, ShadingType, StyleLevel, Table, TableCell, TableOfContents, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} from 'docx'
import { prepare, fitFigure, figPath, meta } from './prepare.mjs'

const OUT = process.argv[2] ?? 'out/CivicFlow_Group15_Project_Report.docx'
const { blocks } = prepare()
const GREEN = '1F5C4A', ORANGE = 'D9531E', INK = '1D2622', MUTED = '5C6862'
const PW = 9638, LW = 14798 // usable widths in DXA (A4, 2 cm / 1.8 cm margins)
const PORTRAIT = [642, 900], LANDSCAPE = [975, 560]
const FONT = 'Calibri'

const runs = (text, opts = {}) => String(text).split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
  part.startsWith('**') ? new TextRun({ text: part.slice(2, -2), bold: true, ...opts }) : new TextRun({ text: part, ...opts }))
const para = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 120, line: 288 }, alignment: AlignmentType.JUSTIFIED, ...opts })

let listInstance = 0
function table(b, width) {
  const ws = b.widths ?? b.head.map(() => 1), total = ws.reduce((a, c) => a + c, 0)
  const cols = ws.map((w) => Math.floor((w / total) * width))
  cols[cols.length - 1] += width - cols.reduce((a, c) => a + c, 0)
  const size = b.tiny ? 15 : b.small ? 17 : 19
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D5DAD6' }
  const borders = { top: border, bottom: border, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }
  const riskFill = (v) => { const n = parseInt(v, 10); return isNaN(n) ? null : n >= 6 ? 'F8D7D1' : n >= 4 ? 'FDEBC8' : 'D8EEE2' }
  const cell = (text, i, header, zebra, rowIdx) => {
    const risk = b.risk && !header && (i === 5 || i === 7) ? riskFill(text) : null
    return new TableCell({
      width: { size: cols[i], type: WidthType.DXA }, borders,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: header ? GREEN : risk ?? (zebra ? 'F4F7F5' : 'FFFFFF') },
      margins: { top: 50, bottom: 50, left: 80, right: 80 }, verticalAlign: header ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
      children: [new Paragraph({ spacing: { after: 0, line: 252 }, children: runs(text, { size, bold: header || !!risk, color: header ? 'FFFFFF' : INK, font: FONT }) })],
    })
  }
  return [
    new Paragraph({ style: 'TableCaption', keepNext: true, spacing: { before: 160, after: 60 }, children: [new TextRun({ text: `${b.label}: `, bold: true, size: 18, color: INK }), new TextRun({ text: b.caption, size: 18, color: MUTED })] }),
    new Table({
      width: { size: width, type: WidthType.DXA }, columnWidths: cols,
      rows: [new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => cell(h, i, true)) }),
        ...b.rows.map((r, k) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, k % 2 === 1, k)) }))],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ]
}

function figure(b) {
  const [bw, bh] = b.landscape ? LANDSCAPE : PORTRAIT
  const { w, h } = fitFigure(b, bw, bh)
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 }, children: [new ImageRun({ type: 'png', data: readFileSync(figPath(b.src)), transformation: { width: w, height: h }, altText: { title: b.label, description: b.caption, name: b.src } })] }),
    new Paragraph({ style: 'FigureCaption', alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `${b.label}: `, bold: true, size: 18, color: INK }), new TextRun({ text: b.caption, size: 18, color: MUTED })] }),
  ]
}

const callout = (title, text) => {
  const opts = { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FDF3EE' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: ORANGE, space: 8 } }, indent: { left: 160, right: 160 } }
  return [new Paragraph({ ...opts, keepNext: true, spacing: { before: 120, after: 0 }, children: [new TextRun({ text: title, bold: true, color: 'A63C12' })] }),
    new Paragraph({ ...opts, spacing: { after: 200, line: 288 }, alignment: AlignmentType.JUSTIFIED, children: runs(text) })]
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

const header = (width) => new Header({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D5DAD6', space: 4 } }, children: [new TextRun({ text: 'CivicFlow – Public Service Complaint & Resolution System', size: 15, color: '7A857F' }), new TextRun({ text: '\tICT2232 · Group 15', size: 15, color: '7A857F' })] })] })
const footer = (width) => new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: width }], children: [new TextRun({ text: 'Final project report', size: 16, color: '7A857F' }), new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '7A857F' })] })] })
const props = (land, first) => ({
  page: { size: { width: 11906, height: 16838, orientation: land ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
    margin: land ? { top: 1134, bottom: 1020, left: 1020, right: 1020 } : { top: 1247, bottom: 1134, left: 1134, right: 1134 },
    ...(first ? { pageNumbers: { start: 1 } } : {}) },
})

// Build sections: cover, then alternating portrait/landscape runs.
const sections = []
let children = [], land = false, firstBody = true
const flush = () => {
  if (!children.length) return
  const width = land ? LW : PW
  sections.push({ properties: props(land, firstBody), headers: { default: header(width) }, footers: { default: footer(width) }, children })
  children = []; firstBody = false
}
for (const b of blocks) {
  const width = land ? LW : PW
  switch (b.t) {
    case 'cover': sections.push({ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1418, right: 1134 } } }, children: cover() }); break
    case 'front': children.push(new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: children.length > 0, children: [new TextRun(b.title)] }), ...b.paras.map((p) => para(p))); break
    case 'toc':
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: true, children: [new TextRun('Table of contents')] }),
        new TableOfContents('Table of contents', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'If page numbers are not shown, right-click the table and choose Update Field.', italics: true, size: 17, color: MUTED })] }),
        new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: true, children: [new TextRun('List of figures')] }),
        new TableOfContents('List of figures', { hyperlink: true, stylesWithLevels: [new StyleLevel('FigureCaption', 1)] }),
        new Paragraph({ heading: HeadingLevel.TITLE, pageBreakBefore: true, children: [new TextRun('List of tables')] }),
        new TableOfContents('List of tables', { hyperlink: true, stylesWithLevels: [new StyleLevel('TableCaption', 1)] }))
      break
    case 'landscape': flush(); land = true; break
    case 'portrait': flush(); land = false; break
    case 'h1': children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun({ text: `${b.num}  `, color: ORANGE }), new TextRun(b.text)] })); break
    case 'h2': children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${b.num}  `, color: '6B7A73' }), new TextRun(b.text)] })); break
    case 'h3': children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `${b.num}  `, color: '6B7A73' }), new TextRun(b.text)] })); break
    case 'p': children.push(para(b.text)); break
    case 'bullets': children.push(...b.items.map((i) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60, line: 276 }, children: runs(i) }))); break
    case 'numbers': case 'refs': { const inst = ++listInstance; children.push(...b.items.map((i) => new Paragraph({ numbering: { reference: 'numbers', level: 0, instance: inst }, spacing: { after: 80, line: 276 }, children: runs(i) }))); break }
    case 'callout': children.push(...callout(b.title, b.text)); break
    case 'table': children.push(...table(b, width)); break
    case 'fig': children.push(...figure(b)); break
  }
}
flush()

const doc = new Document({
  creator: 'Group 15', title: 'CivicFlow – Final Project Report', description: 'ICT2232 Software Engineering mini project report',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 40, bold: true, color: INK }, paragraph: { spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 4 } } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 40, bold: true, color: INK }, paragraph: { spacing: { after: 240 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ORANGE, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: GREEN }, paragraph: { spacing: { before: 300, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'FigureCaption', name: 'FigureCaption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 18 } },
      { id: 'TableCaption', name: 'TableCaption', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: 18 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 280 } } } }] },
    { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 360 } } } }] },
  ] },
  sections,
})
writeFileSync(OUT, await Packer.toBuffer(doc))
console.log('written', OUT, sections.length, 'sections')
