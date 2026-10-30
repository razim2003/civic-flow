// Shared numbering and figure sizing for both renderers.
import { readFileSync } from 'node:fs'
import { blocks, meta } from './content.mjs'

export { meta }
export function pngSize(file) {
  const b = readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}
export const figPath = (src) => `fig/${src}.png`

/** Assigns chapter/section numbers and figure/table labels; returns enriched blocks plus the TOC. */
export function prepare() {
  let ch = 0, sec = 0, sub = 0, fig = 0, tab = 0, landscape = false
  const toc = []
  const out = blocks.map((b) => {
    const x = { ...b, landscape }
    if (b.t === 'landscape') landscape = true
    if (b.t === 'portrait') landscape = false
    if (b.t === 'h1') { ch++; sec = 0; sub = 0; fig = 0; tab = 0; x.num = `${ch}`; x.id = `h-${ch}`; toc.push({ level: 1, num: x.num, text: b.text, id: x.id }) }
    if (b.t === 'h2') { sec++; sub = 0; x.num = `${ch}.${sec}`; x.id = `h-${ch}-${sec}`; toc.push({ level: 2, num: x.num, text: b.text, id: x.id }) }
    if (b.t === 'h3') { sub++; x.num = `${ch}.${sec}.${sub}`; x.id = `h-${ch}-${sec}-${sub}` }
    if (b.t === 'fig') { fig++; x.label = `Figure ${ch}.${fig}`; x.size = pngSize(figPath(b.src)) }
    if (b.t === 'table') { tab++; x.label = `Table ${ch}.${tab}` }
    return x
  })
  const figures = out.filter((b) => b.t === 'fig').map((b) => ({ label: b.label, text: b.caption }))
  const tables = out.filter((b) => b.t === 'table').map((b) => ({ label: b.label, text: b.caption }))
  return { blocks: out, toc, figures, tables }
}

/** Display size in CSS px for a figure given the available box. */
export function fitFigure(b, boxW, boxH) {
  const density = b.src.startsWith('shot') ? 1 : 2.5
  const cssW = b.size.w / density, cssH = b.size.h / density
  const maxW = boxW * (b.w ?? 1), maxH = boxH * (b.maxH ?? 0.82)
  const s = Math.min(maxW / cssW, maxH / cssH, 1.6)
  return { w: Math.round(cssW * s), h: Math.round(cssH * s) }
}
