import type { Page } from '@playwright/test'

/** Saves a labelled UI screenshot for the design/user-guide docs when CAPTURE_SCREENS=1. Data is fictional fixture data. */
export async function capture(page: Page, name: string) {
  if (!process.env.CAPTURE_SCREENS) return
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `docs/sdlc/screens/${name}.png`, fullPage: true, animations: 'disabled' })
}
