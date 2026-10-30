// Renders every diagram to a high-resolution PNG in ./fig using headless Edge.
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mermaidDiagrams } from './diagrams.mjs'
import * as custom from './custom.mjs'

const require = createRequire(new URL('../../../package.json', import.meta.url)) // Playwright from the app
const { chromium } = require('@playwright/test')
const only = process.argv.slice(2)
await mkdir('fig', { recursive: true })
const mermaidJs = await readFile('node_modules/mermaid/dist/mermaid.min.js', 'utf8')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ deviceScaleFactor: 2.5, viewport: { width: 1700, height: 1200 } })

const theme = {
  theme: 'base', securityLevel: 'strict', fontFamily: 'Segoe UI, Arial, sans-serif',
  themeVariables: {
    fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '16px',
    primaryColor: '#e8f1ee', primaryBorderColor: '#1f5c4a', primaryTextColor: '#13201c',
    secondaryColor: '#fdeee6', tertiaryColor: '#f6f4ef', lineColor: '#46564f',
    clusterBkg: '#f8f7f3', clusterBorder: '#8a9690', edgeLabelBackground: '#ffffff',
    actorBkg: '#e8f1ee', actorBorder: '#1f5c4a', actorTextColor: '#13201c', signalColor: '#2b3632', signalTextColor: '#13201c',
    labelBoxBkgColor: '#fdeee6', labelBoxBorderColor: '#d9531e', noteBkgColor: '#fff7d6', noteBorderColor: '#c9a800',
    activationBkgColor: '#d7e8e1', sequenceNumberColor: '#ffffff',
    attributeBackgroundColorOdd: '#ffffff', attributeBackgroundColorEven: '#f3f6f4',
  },
  flowchart: { curve: 'basis', padding: 14, nodeSpacing: 45, rankSpacing: 55, htmlLabels: true, useMaxWidth: false },
  sequence: { useMaxWidth: false, mirrorActors: false, showSequenceNumbers: true, actorMargin: 30, width: 140, boxMargin: 8, messageFontSize: 19, noteFontSize: 17, actorFontSize: 17 },
  er: { fontSize: 14, useMaxWidth: false }, class: { padding: 10, useMaxWidth: false }, state: { useMaxWidth: false },
}

async function shoot(name, html) {
  await page.setContent(`<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;background:#fff}#c{display:inline-block;padding:18px;background:#fff}</style></head><body><div id='c'>${html}</div></body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#c').screenshot({ path: `fig/${name}.png` })
  console.log('ok', name)
}

for (const [name, src] of Object.entries(mermaidDiagrams)) {
  if (name === 'gantt' || (only.length && !only.includes(name))) continue
  await page.setContent(`<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;background:#fff}#c{display:inline-block;padding:18px;background:#fff}</style></head><body><div id='c'></div></body></html>`)
  await page.addScriptTag({ content: mermaidJs })
  const err = await page.evaluate(async ({ src, theme }) => {
    try {
      window.mermaid.initialize({ startOnLoad: false, ...theme })
      const { svg } = await window.mermaid.render('d' + Math.random().toString(36).slice(2), src)
      document.getElementById('c').innerHTML = svg
      const el = document.querySelector('#c svg'); el.style.maxWidth = 'none'
      return null
    } catch (e) { return String(e.message || e) }
  }, { src, theme })
  if (err) { console.error('FAIL', name, err); continue }
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#c').screenshot({ path: `fig/${name}.png` })
  console.log('ok', name)
}

const customs = { 'deployment-uml': custom.deploymentSvg(), 'scrum-cycle': custom.scrumSvg(), 'ci': custom.ciSvg(), 'maintenance': custom.maintenanceSvg(), 'activity-lanes': custom.activitySvg(), 'usecase': custom.useCaseSvg(), 'roadmap': custom.roadmapSvg(), 'test-chart': custom.testChartSvg(),
  'wf-complaint': custom.wireframeComplaint(), 'wf-officer': custom.wireframeOfficer(), 'wf-dispatch': custom.wireframeDispatch(), 'wf-mobile': custom.wireframeMobile() }
for (const [name, html] of Object.entries(customs)) if (!only.length || only.includes(name)) await shoot(name, html)
await browser.close()
await writeFile('fig/.done', new Date().toISOString())
