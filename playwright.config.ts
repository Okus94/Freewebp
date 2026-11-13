import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  // GitHub's runners are slower than a Mac and have no GPU: run fewer tests at once so each gets
  // enough CPU for its animations and WebGL, and give a timing-sensitive test one second chance.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: '.qa/e2e-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
  },
  // Chromium covers Chrome and Edge; WebKit is the engine behind Safari.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // Tests run against the production build, the same files that get deployed.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
