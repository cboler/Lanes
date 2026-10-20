import { defineConfig } from '@playwright/test';

// E2E_PORT serves Lanes elsewhere when 4200 is taken by another project.
const port = process.env['E2E_PORT'] ?? '4200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'phone-portrait',
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'phone-landscape',
      use: {
        viewport: { width: 844, height: 390 },
      },
    },
    {
      name: 'tablet-portrait',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `npm start -- --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000,
  },
});
