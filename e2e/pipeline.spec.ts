import type { Page } from '@playwright/test'
import { fixturePath } from './fixtures'
import { expect, test } from './test'

const fileInput = (page: Page) => page.locator('input[type="file"]')

test('every canvas used for decoding is emptied as soon as its pixels are read', async ({ page }) => {
  // Keep a handle on every canvas the page makes, including the ones it throws away.
  await page.addInitScript(() => {
    const w = window as unknown as { canvases: HTMLCanvasElement[] }
    w.canvases = []
    const create = document.createElement.bind(document)
    document.createElement = ((tag: string, options?: ElementCreationOptions) => {
      const element = create(tag, options)
      if (element instanceof HTMLCanvasElement) w.canvases.push(element)
      return element
    }) as typeof document.createElement
  })
  await page.reload()
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png')])
  await expect(page.getByText('2 of 2 converted')).toBeVisible({ timeout: 15_000 })

  // The chrome button's canvas stays in the page; the decoding canvases are detached and must hold no pixels.
  const sizes = await page.evaluate(() =>
    (window as unknown as { canvases: HTMLCanvasElement[] }).canvases
      .filter((canvas) => !canvas.isConnected)
      .map((canvas) => [canvas.width, canvas.height]),
  )
  expect(sizes.length, 'one canvas per converted image').toBeGreaterThanOrEqual(2)
  for (const size of sizes) expect(size, 'released after reading').toEqual([0, 0])
})
