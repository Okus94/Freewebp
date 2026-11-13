import type { Page } from '@playwright/test'
import { fixturePath } from './fixtures'
import { expect, test } from './test'

const fileInput = (page: Page) => page.locator('input[type="file"]')
const rows = (page: Page) => page.getByRole('list', { name: 'Converted images' }).getByRole('listitem')
/** The live region that sums up the batch for screen readers (visually hidden). */
const progress = (page: Page) => page.getByRole('status').filter({ hasText: /Converting|converted/ })

test('screen readers hear when a batch starts and when it finishes', async ({ page }) => {
  // A 12 MP photo takes a few seconds, long enough to catch the "converting" announcement.
  await fileInput(page).setInputFiles(fixturePath('large.jpg'))
  await expect(progress(page)).toHaveText('Converting 1 image…')
  await expect(progress(page)).toHaveText('1 of 1 image converted.', { timeout: 45_000 })
})

test('screen readers hear which files failed and why', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('too-big.jpg'), fixturePath('notes.pdf')])
  await expect(progress(page)).toHaveText(
    '1 of 3 images converted. too-big.jpg: Larger than 10 MB. notes.pdf: This file type isn’t supported.',
    { timeout: 15_000 },
  )
})

test('the batch-limit notice is a live region', async ({ page }) => {
  await fileInput(page).setInputFiles(Array.from({ length: 21 }, () => fixturePath('photo.jpg')))
  await expect(page.getByRole('status').filter({ hasText: /weren’t added/ })).toBeVisible()
})

/** The accessible name of whatever has keyboard focus. */
const focused = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null)

test('removing a row with the keyboard moves focus to the next row, then the last one, then the field', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png'), fixturePath('animation.gif')])
  await expect(page.getByText('3 of 3 converted')).toBeVisible({ timeout: 15_000 })

  await rows(page).nth(0).getByRole('button', { name: /^Remove/ }).focus()
  await page.keyboard.press('Enter')
  expect(await focused(page), 'the next row takes over').toBe('Remove transparent.png')

  // Now on the middle row; removing it must not wait for the first row's exit animation to finish.
  await page.keyboard.press('Enter')
  expect(await focused(page), 'the only row left').toBe('Remove animation.gif')

  await page.keyboard.press('Enter')
  expect(await focused(page), 'list empty: back to the drop field').toMatch(/^Drop images here/)
  await expect(page.getByRole('list', { name: 'Converted images' })).toHaveCount(0)
})

test('removing the last row moves focus to the row before it', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png')])
  await expect(page.getByText('2 of 2 converted')).toBeVisible({ timeout: 15_000 })
  await rows(page).nth(1).getByRole('button', { name: /^Remove/ }).focus()
  await page.keyboard.press('Enter')
  expect(await focused(page)).toBe('Remove photo.jpg')
})

test('clearing the list moves focus to the drop field', async ({ page }) => {
  await fileInput(page).setInputFiles([fixturePath('photo.jpg'), fixturePath('transparent.png')])
  await expect(page.getByText('2 of 2 converted')).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Clear' }).focus()
  await page.keyboard.press('Enter')
  expect(await focused(page)).toMatch(/^Drop images here/)
  await expect(page.getByRole('list', { name: 'Converted images' })).toHaveCount(0)
})

test('the spinner is decorative; the text carries the status', async ({ page }) => {
  await fileInput(page).setInputFiles(fixturePath('large.jpg'))
  const row = rows(page).first()
  await expect(row.getByText('Converting…')).toBeVisible()
  await expect(row.locator('svg[aria-label]')).toHaveCount(0)
  // The spinner and the remove icon, both hidden from assistive tech like every icon in the app.
  await expect(row.locator('svg[aria-hidden="true"]')).toHaveCount(2)
  await expect(page.getByText('1 of 1 converted')).toBeVisible({ timeout: 45_000 })
})
