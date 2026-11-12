import { expect, test as base } from '@playwright/test'

/**
 * `test` for every spec in this folder: the page starts on the converter, and the test fails if
 * the browser logged an error along the way.
 */
export const test = base.extend<{ cleanConsole: void }>({
  cleanConsole: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
      await page.goto('/')
      await use()
      expect(errors, 'browser console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
