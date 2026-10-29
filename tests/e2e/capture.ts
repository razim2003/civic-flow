import type { Page } from '@playwright/test'

/** Saves a labelled UI screenshot for the design/user-guide docs when CAPTURE_SCREENS=1. Data is fictional fixture data. */
export async function capture(page: Page, name: string) {
  if (!process.env.CAPTURE_SCREENS) return
  await page.evaluate(() => document.fonts.ready)
  // Scroll through once so scroll-triggered reveals have played before the full-page capture.
  await page.evaluate(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += 250) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 140)) } window.scrollTo(0, 0) })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `docs/sdlc/screens/${name}.png`, fullPage: true, animations: 'disabled' })
}
