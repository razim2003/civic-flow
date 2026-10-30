import { mkdir, writeFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'

/** Saves a labelled UI screenshot for the design/user-guide docs when CAPTURE_SCREENS=1. Data is fictional fixture data. */
export async function capture(page: Page, name: string) {
  await audit(page, name)
  if (!process.env.CAPTURE_SCREENS) return
  await page.evaluate(() => document.fonts.ready)
  await playReveals(page)
  await page.screenshot({ path: `docs/sdlc/screens/${name}.png`, fullPage: true, animations: 'disabled' })
}

// Scroll through once so scroll-triggered reveals have played before a full-page capture.
async function playReveals(page: Page) {
  await page.evaluate(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 140)) } window.scrollTo(0, 0) })
  await page.waitForTimeout(700)
}

export const auditViewports = [
  { label: 'phone', width: 360, height: 740 },
  { label: 'phone-large', width: 414, height: 896 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1280, height: 800 },
]

export type LayoutIssue = { kind: 'page-scroll' | 'overflow' | 'outside-parent'; element: string; text: string; by: number }

/** Finds horizontal page scroll, clipped/overflowing content and children poking out of their box. */
export function findLayoutIssues(): LayoutIssue[] {
  const describe = (element: Element) => {
    const classes = typeof element.className === 'string' && element.className.trim() ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''
    return `${element.tagName.toLowerCase()}${classes}`
  }
  const scrollsByDesign = (element: Element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (['auto', 'scroll'].includes(style.overflowX)) return true
      if (node.classList.contains('leaflet-container') || node.classList.contains('marquee')) return true
    }
    return false
  }
  const issues: LayoutIssue[] = []
  const root = document.documentElement
  if (root.scrollWidth > window.innerWidth + 1) issues.push({ kind: 'page-scroll', element: 'html', text: '', by: root.scrollWidth - window.innerWidth })
  for (const element of Array.from(document.querySelectorAll('body *'))) {
    if (!(element instanceof HTMLElement) || element.closest('svg, .leaflet-container, [aria-hidden="true"], .sr-only')) continue
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const style = getComputedStyle(element)
    if (style.position === 'fixed' || style.visibility === 'hidden') continue
    const text = (element.innerText || '').trim().slice(0, 60)
    if (element.scrollWidth > element.clientWidth + 2 && !['auto', 'scroll'].includes(style.overflowX) && element.clientWidth > 0
      && !(style.textOverflow === 'ellipsis') && !scrollsByDesign(element)) {
      issues.push({ kind: 'overflow', element: describe(element), text, by: element.scrollWidth - element.clientWidth })
    }
    const parent = element.parentElement
    if (!parent || scrollsByDesign(parent) || style.position === 'absolute') continue
    const box = parent.getBoundingClientRect()
    const by = Math.max(rect.right - box.right, box.left - rect.left)
    if (by > 2 && getComputedStyle(parent).display !== 'contents') issues.push({ kind: 'outside-parent', element: `${describe(parent)} > ${describe(element)}`, text, by: Math.round(by) })
  }
  return issues
}

/** With LAYOUT_AUDIT=<folder>, re-renders the current screen at each viewport, records issues and screenshots. */
export async function audit(page: Page, name: string) {
  const folder = process.env.LAYOUT_AUDIT
  if (!folder) return
  const original = page.viewportSize()
  await mkdir(folder, { recursive: true })
  const report: Record<string, LayoutIssue[]> = {}
  for (const viewport of auditViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(350)
    await playReveals(page)
    report[viewport.label] = await page.evaluate(findLayoutIssues)
    await page.screenshot({ path: `${folder}/${name}--${viewport.label}.png`, fullPage: true, animations: 'disabled' })
  }
  await writeFile(`${folder}/${name}.json`, JSON.stringify(report, null, 2))
  if (original) await page.setViewportSize(original)
}
