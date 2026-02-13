import { defineConfig, devices } from '@playwright/test';

// Determine if running in Docker (FRONTEND_URL will be set to container name)
const isDocker = process.env.FRONTEND_URL?.includes('frontend:');

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start webServer when running locally (not in Docker or CI)
  webServer: (isDocker || process.env.CI) ? undefined : {
    command: 'cd ../../webapp/frontend && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
