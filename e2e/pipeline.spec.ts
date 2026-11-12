import type { Page } from '@playwright/test'
import { fixturePath } from './fixtures'
import { expect, test } from './test'

const fileInput = (page: Page) => page.locator('input[type="file"]')
const field = (page: Page) => page.getByRole('button', { name: /Drop images here/ })

test('dragging over the field loads the encoder before any file is chosen', async ({ page }) => {
  const wasm = page.waitForRequest((request) => request.url().endsWith('.wasm'), { timeout: 10_000 })
  await field(page).dispatchEvent('dragover', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) })
  await wasm
  // Still no files, and the page didn't do anything visible about it.
  await expect(page.getByRole('list', { name: 'Converted images' })).toHaveCount(0)
})

test('pressing the field loads the encoder too', async ({ page }) => {
  const wasm = page.waitForRequest((request) => request.url().endsWith('.wasm'), { timeout: 10_000 })
  const chooser = page.waitForEvent('filechooser')
  await field(page).click()
  await Promise.all([wasm, chooser])
})

test('removing the converting image does not start the next one alongside it', async ({ page }) => {
  // Log every encode job sent to the worker and every reply, in order.
  await page.addInitScript(() => {
    const w = window as unknown as { log: string[] }
    w.log = []
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (message: { id?: string }, ...rest: unknown[]) {
      if (message?.id) w.log.push(`send ${message.id}`)
      return (post as (this: Worker, ...args: unknown[]) => void).call(this, message, ...rest)
    }
    const onmessage = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!
    Object.defineProperty(Worker.prototype, 'onmessage', {
      get: onmessage.get,
      set(this: Worker, handler: (event: MessageEvent<{ id: string }>) => void) {
        onmessage.set!.call(this, (event: MessageEvent<{ id: string }>) => {
          w.log.push(`reply ${event.data.id}`)
          handler(event)
        })
      },
    })
  })
  await page.reload()

  // A 12 MP photo takes seconds to encode; remove it while that's happening.
  await fileInput(page).setInputFiles([fixturePath('large.jpg'), fixturePath('photo.jpg')])
  const rows = page.getByRole('list', { name: 'Converted images' }).getByRole('listitem')
  await expect(rows.nth(0).getByText('Converting…')).toBeVisible()
  await rows.nth(0).getByRole('button', { name: /^Remove/ }).click()
  await expect(rows).toHaveCount(1)
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 45_000 })

  const log = await page.evaluate(() => (window as unknown as { log: string[] }).log)
  const [first, second] = log.filter((entry) => entry.startsWith('send ')).map((entry) => entry.slice(5))
  expect(log.indexOf(`send ${second}`), 'second job sent only after the first replied').toBeGreaterThan(log.indexOf(`reply ${first}`))
})

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
