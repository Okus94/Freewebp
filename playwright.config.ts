import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
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
