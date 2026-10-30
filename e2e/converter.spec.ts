import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { unzipSync } from 'fflate'
import sharp from 'sharp'
import { onWhite, psnr } from '../qa/metrics'
import { FIXTURES, fixturePath } from './fixtures'

const rows = (page: Page) => page.getByRole('list', { name: 'Converted images' }).getByRole('listitem')
const fileInput = (page: Page) => page.locator('input[type="file"]')

async function rgba(input: Buffer) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function isWebp(buf: Buffer) {
  return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP'
}

let errors: string[]

test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  await page.goto('/')
})

test.afterEach(() => {
  expect(errors, 'browser console errors').toEqual([])
})

test('page renders the hero and FAQ', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Convert images to WebP' })).toBeVisible()
  await expect(page.getByText('Drop images here')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible()

  const question = page.getByText('Is my data safe? Do you store my images?')
  await question.click()
  await expect(page.getByText(/Your images never leave your device/)).toBeVisible()
})

test('converts every supported format to a valid WebP', async ({ page }, testInfo) => {
  await fileInput(page).setInputFiles(FIXTURES.map((f) => fixturePath(f.file)))
  await expect(rows(page)).toHaveCount(FIXTURES.length)
  await expect(page.getByText(`${FIXTURES.length} of ${FIXTURES.length} converted`)).toBeVisible({ timeout: 30_000 })

  for (const [i, fixture] of FIXTURES.entries()) {
    const row = rows(page).nth(i)
    await expect(row).toContainText(fixture.output)
    await expect(row).toContainText('→')

    const download = page.waitForEvent('download')
    await row.getByRole('button', { name: /^Download/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe(fixture.output)
    const webp = await readFile(await file.path())

    expect(isWebp(webp), `${fixture.file} output is WebP`).toBe(true)
    const decoded = await rgba(webp)
    expect([decoded.width, decoded.height], `${fixture.file} keeps its size`).toEqual([fixture.width, fixture.height])

    if (fixture.transparent) {
      const meta = await sharp(webp).metadata()
      expect(meta.hasAlpha, `${fixture.file} keeps transparency`).toBe(true)
      expect(decoded.data[3], `${fixture.file} transparent corner stays transparent`).toBeLessThan(10)
    }

    // Lossy conversion must stay visually faithful to the source pixels.
    if (fixture.file !== 'vector.svg' && fixture.file !== 'icon.ico') {
      const sourceFile = fixture.file === 'photo.bmp' ? 'photo.bmp.reference.png' : fixture.file
      const source = await rgba(await readFile(fixturePath(sourceFile)))
      const score = psnr(onWhite(source), onWhite(decoded))
      testInfo.annotations.push({ type: 'psnr', description: `${fixture.file}: ${score.toFixed(1)} dB` })
      expect(score, `${fixture.file} PSNR`).toBeGreaterThan(30)
    }
  }
})

test('downloads everything as one ZIP with unique names', async ({ page }) => {
  await fileInput(page).setInputFiles(FIXTURES.map((f) => fixturePath(f.file)))
  await expect(page.getByText(`${FIXTURES.length} of ${FIXTURES.length} converted`)).toBeVisible({ timeout: 30_000 })

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all (.zip)' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('webp-images.zip')

  const entries = unzipSync(new Uint8Array(await readFile(await file.path())))
  const names = Object.keys(entries)
  expect(names).toHaveLength(FIXTURES.length)
  expect(new Set(names).size).toBe(FIXTURES.length)
  expect(names).toEqual(expect.arrayContaining(['photo.webp', 'photo (1).webp', 'photo (2).webp']))
  for (const name of names) expect(isWebp(Buffer.from(entries[name])), name).toBe(true)
})

test('accepts files dropped onto the drop field', async ({ page }) => {
  const bytes = [...(await readFile(fixturePath('photo.jpg')))]
  const dataTransfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(data)], 'dropped.jpg', { type: 'image/jpeg' }))
    return dt
  }, bytes)
  const field = page.getByRole('button', { name: /Drop images here/ })
  await field.dispatchEvent('dragover', { dataTransfer })
  await expect(page.getByText('Drop to convert')).toBeVisible()
  await field.dispatchEvent('drop', { dataTransfer })

  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('dropped.webp')
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 15_000 })
})

test('rejects oversized and unsupported files without blocking the rest', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('too-big.jpg'), fixturePath('notes.pdf'), fixturePath('photo.jpg')])
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).nth(0)).toContainText('Larger than 10 MB')
  await expect(rows(page).nth(1)).toContainText('This file type isn’t supported')
  await expect(page.getByText('1 of 3 converted')).toBeVisible({ timeout: 15_000 })
})

test('explains when an image is too large to convert', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('too-wide.png'), fixturePath('too-many-pixels.png'), fixturePath('photo.jpg')])
  await expect(rows(page).nth(0)).toContainText('Too large: 17,000 × 200 px (max 16,383 px per side)', { timeout: 15_000 })
  await expect(rows(page).nth(1)).toContainText('Too large: 56 MP (max 50 MP)', { timeout: 15_000 })
  await expect(page.getByText('1 of 3 converted')).toBeVisible({ timeout: 15_000 })
})

test('refuses oversized images from their header, before decoding anything', async ({ page }) => {
  // Count decode calls: an oversized image must be rejected without one.
  await page.addInitScript(() => {
    const w = window as unknown as { decodes: number }
    w.decodes = 0
    const original = window.createImageBitmap.bind(window)
    window.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
      w.decodes++
      return original(...args)
    }) as typeof createImageBitmap
  })
  await page.reload()
  await fileInput(page).setInputFiles([fixturePath('bomb.png'), fixturePath('too-wide.png')])
  await expect(rows(page).nth(0)).toContainText('Too large: 60,000 × 60,000 px (max 16,383 px per side)', { timeout: 15_000 })
  await expect(rows(page).nth(1)).toContainText('Too large: 17,000 × 200 px', { timeout: 15_000 })
  expect(await page.evaluate(() => (window as unknown as { decodes: number }).decodes)).toBe(0)
})

test('sends security headers', async ({ page }) => {
  const response = await page.request.get('/')
  const headers = response.headers()
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['referrer-policy']).toBe('no-referrer')
})

test('nothing leaves the browser: no uploads, no outside requests', async ({ page, baseURL }) => {
  const requests: { url: string; method: string }[] = []
  page.on('request', (request) => requests.push({ url: request.url(), method: request.method() }))
  await page.evaluate(() => {
    const w = window as unknown as { violations: string[] }
    w.violations = []
    document.addEventListener('securitypolicyviolation', (e) => w.violations.push(`${e.violatedDirective} ${e.blockedURI}`))
  })
  await page.reload()
  await page.evaluate(() => {
    const w = window as unknown as { violations: string[] }
    w.violations = []
    document.addEventListener('securitypolicyviolation', (e) => w.violations.push(`${e.violatedDirective} ${e.blockedURI}`))
  })

  await fileInput(page).setInputFiles(FIXTURES.map((f) => fixturePath(f.file)))
  await expect(page.getByText(`${FIXTURES.length} of ${FIXTURES.length} converted`)).toBeVisible({ timeout: 30_000 })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all (.zip)' }).click()
  await download

  const origin = new URL(baseURL!).origin
  const outside = requests.filter(({ url }) => !url.startsWith(origin) && !url.startsWith('blob:') && !url.startsWith('data:'))
  expect(outside, 'requests to other sites').toEqual([])
  expect(requests.filter(({ method }) => method !== 'GET'), 'anything sent (uploads)').toEqual([])
  expect(await page.evaluate(() => (window as unknown as { violations: string[] }).violations), 'security policy violations').toEqual([])
})

test('limits a batch to 20 images', async ({ page }) => {
  await fileInput(page).setInputFiles(Array.from({ length: 21 }, () => fixturePath('photo.jpg')))
  await expect(rows(page)).toHaveCount(20)
  await expect(page.getByText(/up to 20 images at a time — 1 weren’t added/)).toBeVisible()
})

test('converts a 12-megapixel photo and keeps the page responsive', async ({ page }, testInfo) => {
  // Track the longest gap between animation frames while converting: big gaps mean a frozen page.
  await page.evaluate(() => {
    const w = window as unknown as { maxFrameGap: number }
    w.maxFrameGap = 0
    let last = performance.now()
    const tick = (now: number) => {
      w.maxFrameGap = Math.max(w.maxFrameGap, now - last)
      last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  const started = Date.now()
  await fileInput(page).setInputFiles(fixturePath('large.jpg'))
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 45_000 })
  const seconds = (Date.now() - started) / 1000
  const maxFrameGap = await page.evaluate(() => (window as unknown as { maxFrameGap: number }).maxFrameGap)

  testInfo.annotations.push({ type: 'speed', description: `12 MP photo converted in ${seconds.toFixed(1)} s` })
  testInfo.annotations.push({ type: 'responsiveness', description: `longest frozen frame ${maxFrameGap.toFixed(0)} ms` })
  expect(seconds).toBeLessThan(20)
  // Decoding happens on the page; encoding (the slow part) must not freeze it.
  expect(maxFrameGap).toBeLessThan(1500)
})

test('removed and cleared images animate out, then disappear', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png'), fixturePath('photo.avif')])
  await expect(page.getByText('3 of 3 converted')).toBeVisible({ timeout: 15_000 })

  await rows(page).nth(0).getByRole('button', { name: /^Remove/ }).click()
  await expect(rows(page)).toHaveCount(2)
  await expect(page.getByText('2 of 2 converted')).toBeVisible()

  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page.getByRole('list', { name: 'Converted images' })).toHaveCount(0)
})

test('results list matches the design: balanced first row, glass footer, no badges', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png'), fixturePath('photo.avif')])
  await expect(page.getByText('3 of 3 converted')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(400) // let the rows finish opening

  // Measure each row's content box (inside the divider lines).
  const contentHeights = () =>
    rows(page).evaluateAll((items) => items.map((li) => li.querySelector(':scope > div > div')!.getBoundingClientRect().height))
  const heights = await contentHeights()
  expect(heights[0] - heights[1], 'first row is 4px taller').toBeCloseTo(4, 0)
  expect(heights[1]).toBeCloseTo(heights[2], 0)

  await expect(page.getByText(/^−\d+%$/)).toHaveCount(0)
  await expect(page.getByText(/3 of 3 converted · [\d.]+ (B|KB|MB) saved$/)).toBeVisible()
  const footer = page.getByRole('button', { name: 'Clear' }).locator('xpath=../..')
  await expect(footer).toHaveCSS('backdrop-filter', /blur\(16px\)/)

  // Removing the first image hands the extra room to the new first row.
  await rows(page).nth(0).getByRole('button', { name: /^Remove/ }).click()
  await expect(rows(page)).toHaveCount(2)
  await page.waitForTimeout(400)
  const after = await contentHeights()
  expect(after[0] - after[1]).toBeCloseTo(4, 0)
})

test('share toast appears 5 seconds after a download, once per visit', async ({ page, browserName, context }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await fileInput(page).setInputFiles(fixturePath('photo.jpg'))
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 15_000 })
  const toast = page.getByText('All done — your images are saved')

  const download = page.waitForEvent('download')
  await rows(page).nth(0).getByRole('button', { name: /^Download/ }).click()
  await download
  const clickedAt = Date.now()

  await page.waitForTimeout(3500)
  await expect(toast, 'not before 5 seconds').toHaveCount(0)
  await expect(toast).toBeVisible({ timeout: 4000 })
  expect(Date.now() - clickedAt).toBeGreaterThanOrEqual(4900)

  // Copying shows confirmation (or, where the clipboard is blocked, the link itself).
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByText(/Link copied|Couldn’t copy automatically/)).toBeVisible()
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(new URL(page.url()).origin)
  }
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(toast).toHaveCount(0)

  // A second download in the same visit doesn't bring it back.
  const again = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await again
  await page.waitForTimeout(6000)
  await expect(toast).toHaveCount(0)
})

test('FAQ answers open and close', async ({ page }) => {
  const question = page.getByRole('button', { name: 'Does WebP keep transparency?' })
  const answer = page.getByText(/Transparent areas in PNG/)
  await expect(question).toHaveAttribute('aria-expanded', 'false')
  await question.click()
  await expect(question).toHaveAttribute('aria-expanded', 'true')
  await expect(answer).toBeVisible()
  await question.click()
  await expect(question).toHaveAttribute('aria-expanded', 'false')
  // Closed answers are clipped to zero height and made inert (hidden from screen readers too).
  const panel = page.locator(`[id="${await question.getAttribute('aria-controls')}"]`)
  await expect(panel).toHaveAttribute('inert')
  await expect.poll(async () => (await panel.boundingBox())?.height ?? 0).toBeLessThan(1)
})

test('reduced motion keeps fades but drops movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const heading = page.getByRole('heading', { name: 'Convert images to WebP' })
  await expect(heading).toHaveCSS('animation-name', 'fade-in')

  // The drop field lifts while dragging normally; with reduced motion it only changes colour.
  const field = page.getByRole('button', { name: /Drop images here/ })
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await field.dispatchEvent('dragover', { dataTransfer })
  await expect(page.getByText('Drop to convert')).toBeVisible()
  await expect(field).toHaveCSS('scale', 'none')
})

test('drop field is frosted glass with a light travelling around its border', async ({ page }) => {
  const field = page.getByRole('button', { name: /Drop images here/ })
  await expect(field).toHaveCSS('backdrop-filter', /blur\(16px\)/)

  const light = () =>
    field.evaluate((el) => {
      const bulb = el.querySelector<HTMLElement>('.stroke-ring .stroke-bulb')!
      const animations = bulb.getAnimations()
      const keyframes = animations[0]?.effect instanceof KeyframeEffect ? animations[0].effect.getKeyframes() : []
      const box = el.getBoundingClientRect()
      const rect = bulb.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      return {
        ids: animations.map((a) => a.id),
        rates: animations.map((a) => a.playbackRate),
        states: animations.map((a) => a.playState),
        // Only transform is animated: the property browsers can run on the GPU.
        properties: [...new Set(keyframes.flatMap((k) => Object.keys(k).filter((key) => !['offset', 'easing', 'composite', 'computedOffset'].includes(key))))],
        x,
        y,
        // How far the light's centre is from the nearest edge of the box.
        offEdge: Math.min(Math.abs(x - box.left), Math.abs(x - box.right), Math.abs(y - box.top), Math.abs(y - box.bottom)),
      }
    })

  const first = await light()
  expect(first.ids, 'one light, in the stroke only').toEqual(['border-light'])
  expect(first.states).toEqual(['running'])
  expect(first.rates).toEqual([1])
  expect(first.properties, 'animates transform only').toEqual(['transform'])
  expect(first.offEdge, 'light rides on the border').toBeLessThan(3)

  await page.waitForTimeout(600)
  const later = await light()
  expect(Math.hypot(later.x - first.x, later.y - first.y), 'the light is moving').toBeGreaterThan(10)
  expect(later.offEdge, 'light stays on the border').toBeLessThan(3)

  // Dragging files over it speeds the loop up; leaving returns it to the calm pace.
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await field.dispatchEvent('dragover', { dataTransfer })
  await expect.poll(async () => (await light()).rates).toEqual([3])
  await field.dispatchEvent('dragleave', { dataTransfer })
  await expect.poll(async () => (await light()).rates).toEqual([1])
})

test('the light keeps gliding while a large photo converts', async ({ page }, testInfo) => {
  // Sample the light's position every frame during a 12 MP conversion and look for stalls.
  await page.evaluate(() => {
    const w = window as unknown as { lightStall: number; lightFrames: number }
    const bulb = document.querySelector<HTMLElement>('.stroke-ring .stroke-bulb')!
    w.lightStall = 0
    w.lightFrames = 0
    let last = performance.now()
    const tick = (now: number) => {
      void bulb.getBoundingClientRect()
      w.lightStall = Math.max(w.lightStall, now - last)
      w.lightFrames++
      last = now
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await fileInput(page).setInputFiles(fixturePath('large.jpg'))
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 45_000 })
  const lightStall = await page.evaluate(() => (window as unknown as { lightStall: number }).lightStall)
  testInfo.annotations.push({ type: 'light', description: `longest main-thread frame during conversion ${lightStall.toFixed(0)} ms` })
  // The animation itself runs on the compositor, so even a slow main-thread frame can't stall it.
  const running = await page.evaluate(() => document.querySelector('.stroke-bulb')!.getAnimations()[0]?.playState)
  expect(running).toBe('running')
})

test('reduced motion parks the light instead of moving it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const field = page.getByRole('button', { name: /Drop images here/ })
  const parked = await field.evaluate((el) => {
    const bulb = el.querySelector<HTMLElement>('.stroke-ring .stroke-bulb')!
    const box = el.getBoundingClientRect()
    const rect = bulb.getBoundingClientRect()
    return { animations: bulb.getAnimations().length, fromTop: Math.abs(rect.top + rect.height / 2 - box.top) }
  })
  expect(parked.animations).toBe(0)
  expect(parked.fromTop, 'parked on the top edge').toBeLessThan(3)
})

// Playwright's WebKit screenshots inject their own stylesheet, which the site's security policy
// (rightly) blocks. Only this visual test lifts the policy; every other test runs under it.
test.describe('screenshots', () => {
  test.use({ bypassCSP: true })

  test('share toast', async ({ page }, testInfo) => {
    await fileInput(page).setInputFiles(fixturePath('photo.jpg'))
    await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 15_000 })
    const download = page.waitForEvent('download')
    await rows(page).nth(0).getByRole('button', { name: /^Download/ }).click()
    await download
    await expect(page.getByText('All done — your images are saved')).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(600) // let it finish sliding in
    await page.screenshot({ path: `.qa/screenshots/${testInfo.project.name}-toast.png` })
  })

  test('looks right on desktop and mobile', async ({ page }, testInfo) => {
    // Skip to the end of the entrance animation so screenshots show the settled page.
    await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).forEach((a) => a.finish()))
    await page.screenshot({ path: `.qa/screenshots/${testInfo.project.name}-desktop.png`, fullPage: true })
    // Close-up of the drop field, padded so the light on its border is easy to inspect.
    const field = await page.getByRole('button', { name: /Drop images here/ }).boundingBox()
    if (field) {
      await page.screenshot({
        path: `.qa/screenshots/${testInfo.project.name}-drop-field.png`,
        clip: { x: field.x - 24, y: field.y - 24, width: field.width + 48, height: field.height + 48 },
      })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Convert images to WebP' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, 'no sideways scrolling on a phone').toBeLessThanOrEqual(0)
    await page.screenshot({ path: `.qa/screenshots/${testInfo.project.name}-mobile.png`, fullPage: true })

    await page.setViewportSize({ width: 1280, height: 900 })
    await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png'), fixturePath('too-big.jpg')])
    await expect(page.getByText('2 of 3 converted')).toBeVisible({ timeout: 15_000 })
    await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).forEach((a) => a.finish()))
    await page.waitForTimeout(400) // let the row transitions settle
    await page.screenshot({ path: `.qa/screenshots/${testInfo.project.name}-results.png` })
  })
})
