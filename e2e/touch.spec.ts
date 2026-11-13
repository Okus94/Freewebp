import { expect, test } from './test'

// A phone: coarse pointer, touch events, narrow screen.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

test('on a touch screen, screen readers hear "Tap to choose images", like the visible label', async ({ page }) => {
  const field = page.getByRole('button', { name: 'Tap to choose images', exact: true })
  await expect(field).toBeVisible()
  await expect(page.getByRole('button', { name: /press Enter/ })).toHaveCount(0)
  // Tapping it still opens the file picker.
  const chooser = page.waitForEvent('filechooser')
  await field.tap()
  await chooser
})
