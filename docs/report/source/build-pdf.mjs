// Builds the PDF in two passes: a measuring pass that records the page of every block, then the final pass with contents page numbers.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { prepare, fitFigure, figPath, meta } from './prepare.mjs'

const require = createRequire(new URL('../../../package.json', import.meta.url)) // Playwright from the app
const { chromium } = require('@playwright/test')
const OUT = process.argv[2] ?? 'out/CivicFlow_Group15_Project_Report.pdf'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
const { blocks, toc, figures, tables } = prepare()
const PORTRAIT = [642, 930], LANDSCAPE = [975, 600]

const css = `
*{box-sizing:border-box}
body{font-family:Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1d2622;margin:0;font-kerning:none;font-variant-ligatures:none} /* wrap like Word, which uses neither */
.land{page:land}
.coverpage{page:cover;height:297mm;width:210mm;position:relative;overflow:hidden;break-after:page}
.cv-band{position:absolute;left:0;top:0;bottom:0;width:16mm;background:#1f5c4a}
.cv-band:after{content:'';position:absolute;left:0;right:0;top:118mm;height:38mm;background:#d9531e}
.cv-in{position:absolute;left:32mm;right:22mm;top:24mm;bottom:20mm;display:flex;flex-direction:column}
.cv-uni{font-size:12pt;letter-spacing:.14em;text-transform:uppercase;color:#1f5c4a;font-weight:700}
.cv-mod{font-size:11pt;color:#5c6862;margin-top:2mm}
.cv-title{font-family:'Segoe UI',Calibri,sans-serif;font-size:46pt;font-weight:800;letter-spacing:-.02em;color:#13201c;margin:30mm 0 0;line-height:1}
.cv-title span{color:#d9531e}
.cv-sub{font-size:19pt;color:#1f5c4a;font-weight:600;margin-top:4mm}
.cv-kind{font-size:12.5pt;color:#5c6862;margin-top:3mm;border-top:2px solid #d9531e;padding-top:3mm;width:120mm}
.cv-shot{margin-top:10mm;width:150mm;border:1px solid #c9cec9;border-radius:6px;box-shadow:0 6px 24px #0002}
.cv-meta{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.cv-meta h4{margin:0 0 2mm;font-size:9.5pt;letter-spacing:.12em;text-transform:uppercase;color:#1f5c4a}
.cv-meta table{border-collapse:collapse;font-size:10.5pt}.cv-meta td{padding:.6mm 4mm .6mm 0;border:0}
.cv-meta p{margin:0 0 1.5mm;font-size:10.5pt}
.front{break-after:page}
h1.fronth{font-family:'Segoe UI',Calibri,sans-serif;font-size:20pt;color:#13201c;margin:0 0 6mm;border-bottom:2px solid #d9531e;padding-bottom:2mm}
.tocwrap{break-after:page}
.toc-row{display:flex;align-items:baseline;gap:6px;font-size:10.5pt;line-height:1.55}
.toc-row.l1{font-weight:700;margin-top:2.2mm;font-size:11pt}
.toc-row.l2{padding-left:9mm}
.toc-row.fl{font-size:10pt;line-height:1.4}
.toc-row .n{min-width:11mm}.toc-row.l2 .n{min-width:12mm}
.toc-row .dots{flex:1;border-bottom:1px dotted #9aa39f;transform:translateY(-3px)}
.toc-row a{color:inherit;text-decoration:none}
.toc-row .pg{min-width:8mm;text-align:right;font-variant-numeric:tabular-nums}
h1.ch{font-family:'Segoe UI',Calibri,sans-serif;font-size:21pt;color:#13201c;margin:0 0 5mm;break-before:page;break-after:avoid;display:flex;gap:4mm;align-items:baseline;border-bottom:2px solid #d9531e;padding-bottom:2mm}
h1.ch .num{color:#d9531e}
h2{font-family:'Segoe UI',Calibri,sans-serif;font-size:14pt;color:#1f5c4a;margin:7mm 0 2.5mm;break-after:avoid}
h3{font-family:'Segoe UI',Calibri,sans-serif;font-size:12pt;color:#13201c;margin:5mm 0 2mm;break-after:avoid}
h2 .num,h3 .num{color:#6b7a73;margin-right:3mm;font-weight:600}
p{margin:0 0 3mm;text-align:justify;break-inside:avoid}
.mk{position:absolute;font-size:2px;line-height:1;color:#fff;white-space:nowrap}
ul,ol{margin:0 0 3.5mm;padding-left:7mm}li{margin:0 0 1.4mm;break-inside:avoid}
.callout{border-left:4px solid #d9531e;background:#fdf3ee;padding:3mm 4.5mm;margin:3mm 0 4mm;break-inside:avoid}
.callout b{display:block;color:#a63c12;font-family:'Segoe UI',Calibri,sans-serif;margin-bottom:1mm}
.callout p{margin:0}
figure{margin:4mm 0 5mm;text-align:center;break-inside:avoid}
figure img{display:block;margin:0 auto}
figcaption,.tcap{font-size:9.5pt;color:#46564f;margin-top:2mm}
figcaption b,.tcap b{color:#13201c}
.tcap{margin:4mm 0 1.6mm;text-align:left;break-after:avoid}
table.t{width:100%;border-collapse:collapse;margin:0 0 5mm;font-size:9.5pt;line-height:1.35;page-break-inside:auto}
table.t.sm{font-size:8.8pt}table.t.xs{font-size:8pt}
table.t th{background:#1f5c4a;color:#fff;text-align:left;padding:1.6mm 2mm;font-weight:700;vertical-align:bottom}
table.t td{padding:1.4mm 2mm;border-bottom:1px solid #d5dad6;vertical-align:top;overflow-wrap:anywhere}
table.t tr{break-inside:avoid}table.t thead{display:table-header-group}
table.t tbody tr:nth-child(even) td{background:#f4f7f5}
td.r-high{background:#f8d7d1 !important;font-weight:700;color:#7d1d0c;text-align:center}
td.r-med{background:#fdebc8 !important;font-weight:700;color:#6a4500;text-align:center}
td.r-low{background:#d8eee2 !important;font-weight:700;color:#0e4a2c;text-align:center}
.refs{padding-left:8mm}.refs li{margin-bottom:2mm;font-size:10.5pt}
`

function tableHtml(b, k, mk) {
  const total = (b.widths ?? b.head.map(() => 1)).reduce((a, c) => a + c, 0)
  const cols = (b.widths ?? b.head.map(() => 1)).map((w) => `<col style="width:${(w / total * 100).toFixed(2)}%">`).join('')
  const riskCls = (v) => { const n = parseInt(v, 10); return isNaN(n) ? '' : n >= 6 ? 'r-high' : n >= 4 ? 'r-med' : 'r-low' }
  const rows = b.rows.map((r, ri) => `<tr>${r.map((c, i) => `<td class="${b.risk && (i === 5 || i === 7) ? riskCls(c) : ''}">${i === 0 ? mk(`R${k}.${ri}`) : ''}${inline(c)}</td>`).join('')}</tr>`).join('')
  return `<div class="tcap">${mk(`B${k}`)}<b>${b.label}:</b> ${esc(b.caption)}</div><table class="t ${b.tiny ? 'xs' : b.small ? 'sm' : ''}"><colgroup>${cols}</colgroup><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
}

// `mark` adds invisible, out-of-flow page markers (measuring pass only). They do not change the layout.
function chunks(pages, mark) {
  const pg = (id) => pages?.[id] ?? '00'
  const mk = (key) => mark ? `<span class="mk">@@${key}@@</span>` : ''
  const out = []
  let parts = [], land = false
  const flush = () => { if (parts.length) out.push({ land, html: doc(parts.join('\n'), land) }); parts = [] }
  const section = (l) => { flush(); land = l }
  const row = (cls, key, n, nw, text, id, page) => `<div class="toc-row ${cls}">${mk(key)}<span class="n"${nw ? ` style="min-width:${nw}"` : ''}>${n}</span>${id ? `<a href="#${id}">${esc(text)}</a>` : `<span>${esc(text)}</span>`}<span class="dots"></span><span class="pg">${page}</span></div>`
  for (const [k, b] of blocks.entries()) {
    switch (b.t) {
      case 'cover': flush(); parts.push(`<div class="coverpage"><div class="cv-band"></div><div class="cv-in">
        <div class="cv-uni">${esc(meta.university)}</div><div class="cv-mod">ICT2232 Software Engineering · Mini Project</div>
        <div class="cv-title">Civic<span>Flow</span></div><div class="cv-sub">${esc(meta.subtitle)}</div>
        <div class="cv-kind">Final Project Report · SDLC documentation · ${esc(meta.group)}</div>
        <img class="cv-shot" src="${pathToFileURL(figPath('shot-landing')).href}">
        <div class="cv-meta"><div><h4>Group 15 members</h4><table>${meta.members.map(([id, n]) => `<tr><td>${id}</td><td>${esc(n)}</td></tr>`).join('')}</table></div>
        <div><h4>Submission</h4><p>Lecturer: ${esc(meta.lecturer)}</p><p>Date: ${esc(meta.date)}</p><p>Live system: ${esc(meta.url)}</p><p>Repository: ${esc(meta.repo.replace('https://', ''))}</p></div></div></div></div>`); out.push({ land: false, cover: true, html: doc(parts.join(''), false, true) }); parts = []; break
      case 'front': parts.push(`<div class="front"><h1 class="fronth">${mk(`B${k}`)}${esc(b.title)}</h1>${b.paras.map((p) => `<p>${inline(p)}</p>`).join('')}</div>`); break
      case 'toc': parts.push(`<div class="tocwrap"><h1 class="fronth" id="toc">${mk('X0')}Table of contents</h1>${toc.map((e, i) => row(`l${e.level}`, `T${i}`, e.num, '', e.text, e.id, pg(e.id))).join('')}</div>
        <div class="tocwrap"><h1 class="fronth">${mk('X1')}List of figures</h1>${figures.map((f, i) => row('fl', `F${i}`, f.label, '24mm', f.text, '', pg(f.label))).join('')}</div>
        <div class="tocwrap"><h1 class="fronth">${mk('X2')}List of tables</h1>${tables.map((f, i) => row('fl', `L${i}`, f.label, '22mm', f.text, '', pg(f.label))).join('')}</div>`); break
      case 'landscape': section(true); break
      case 'portrait': section(false); break
      case 'h1': parts.push(`<h1 class="ch" id="${b.id}">${mk(`B${k}`)}<span class="num">${b.num}</span><span>${esc(b.text)}</span></h1>`); break
      case 'h2': parts.push(`<h2 id="${b.id}">${mk(`B${k}`)}<span class="num">${b.num}</span>${esc(b.text)}</h2>`); break
      case 'h3': parts.push(`<h3 id="${b.id}">${mk(`B${k}`)}<span class="num">${b.num}</span>${esc(b.text)}</h3>`); break
      case 'p': parts.push(`<p>${mk(`B${k}`)}${inline(b.text)}</p>`); break
      case 'bullets': parts.push(`<ul>${b.items.map((i, n) => `<li>${mk(`I${k}.${n}`)}${inline(i)}</li>`).join('')}</ul>`); break
      case 'numbers': parts.push(`<ol>${b.items.map((i, n) => `<li>${mk(`I${k}.${n}`)}${inline(i)}</li>`).join('')}</ol>`); break
      case 'refs': parts.push(`<ol class="refs">${b.items.map((i, n) => `<li>${mk(`I${k}.${n}`)}${esc(i)}</li>`).join('')}</ol>`); break
      case 'callout': parts.push(`<div class="callout">${mk(`B${k}`)}<b>${esc(b.title)}</b><p>${inline(b.text)}</p></div>`); break
      case 'table': parts.push(tableHtml(b, k, mk)); break
      case 'fig': {
        const [bw, bh] = b.landscape ? LANDSCAPE : PORTRAIT
        const { w, h } = fitFigure(b, bw, bh)
        parts.push(`<figure>${mk(`B${k}`)}<img src="${pathToFileURL(figPath(b.src)).href}" style="width:${w}px;height:${h}px"><figcaption><b>${b.label}:</b> ${esc(b.caption)}</figcaption></figure>`); break
      }
    }
  }
  flush()
  return out
}
const doc = (inner, land, cover) => `<!doctype html><html><head><meta charset="utf-8"><title>CivicFlow – Group 15 Project Report</title><style>${css}
@page { size: A4 ${land ? 'landscape' : 'portrait'}; margin: ${cover ? '0' : land ? '20mm 18mm 18mm 18mm' : '24mm 20mm 20mm 20mm'}; }</style></head><body>${inner}</body></html>`

mkdirSync('out', { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage()
async function render(pages, file, mode) {
  const list = chunks(pages, mode === 'measure'), files = []
  for (const [i, c] of list.entries()) {
    writeFileSync(`out/chunk-${i}.html`, c.html)
    await page.goto(pathToFileURL(`out/chunk-${i}.html`).href)
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    await page.pdf({ path: `out/chunk-${i}.pdf`, preferCSSPageSize: true, printBackground: true })
    files.push(`out/chunk-${i}.pdf`)
  }
  writeFileSync('out/manifest.json', JSON.stringify({ mode, files, output: file, toc, figures, tables, pages }))
  execFileSync('python', ['-I', 'merge.py', 'out/manifest.json'], { stdio: 'inherit' })
}

// Pass 1 measures where every block, list item, table row and contents entry lands (out/layout.json).
await render(null, 'out/pass1.pdf', 'measure')
const { markers } = JSON.parse(readFileSync('out/layout.json', 'utf8'))
const at = (key) => { if (markers[key] === undefined) throw new Error(`no page marker ${key}`); return markers[key] }
const pages = {}
for (const [k, b] of blocks.entries()) {
  if (b.t === 'h1' || b.t === 'h2') pages[b.id] = at(`B${k}`)
  if (b.t === 'fig' || b.t === 'table') pages[b.label] = at(`B${k}`)
}
for (const k of ['X0', 'X1', 'X2']) pages[k] = at(k)
// Pass 2 renders the final PDF with the page numbers filled in; merge.py re-checks them against the text.
await render(pages, OUT, 'final')
await browser.close()
console.log('written', OUT)
