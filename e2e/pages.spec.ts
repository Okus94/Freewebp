import { expect, test } from './test'

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })

  test('each page says what it needs instead of staying blank, in the site’s own styling', async ({ page }) => {
    const message = (text: RegExp) => page.locator('noscript p').filter({ hasText: text })
    await expect(message(/needs JavaScript to run/)).toBeVisible()
    // The built stylesheet loads without JavaScript, so the message gets the site's font and paper background.
    const style = await message(/needs JavaScript/).evaluate((p) => {
      const body = getComputedStyle(document.body)
      return { font: getComputedStyle(p).fontFamily, background: body.backgroundColor, align: getComputedStyle(p).textAlign }
    })
    expect(style.font).toContain('Geist')
    expect(style.background).toBe('rgb(251, 245, 241)') // --color-paper
    expect(style.align).toBe('center')

    await page.goto('/privacy/')
    await expect(message(/Your images never leave your device/)).toBeVisible()
    await expect(message(/never leave/).getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', 'https://github.com/Okus94/Freewebp')

    await page.goto('/404.html')
    await expect(message(/This page doesn’t exist/)).toBeVisible()
    await expect(message(/doesn’t exist/).getByRole('link', { name: 'freewebp.org' })).toHaveAttribute('href', '/')
  })
})

test('with JavaScript on, the fallback stays out of the way', async ({ page }) => {
  await expect(page.locator('noscript p')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Convert images to WebP' })).toBeVisible()
})

test('the 404 page links the web manifest like every other page', async ({ page }) => {
  for (const path of ['/', '/privacy/', '/404.html']) {
    const html = await (await page.request.get(path)).text()
    expect(html, path).toContain('<link rel="manifest" href="/site.webmanifest"')
  }
})
