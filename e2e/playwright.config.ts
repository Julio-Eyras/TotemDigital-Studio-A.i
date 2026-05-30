import { defineConfig, devices } from '@playwright/test';

const frontendPort = process.env.E2E_FRONTEND_PORT || '3001';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${frontendPort}`;

/** Modo mock — só frontend; API simulada em e2e/helpers/mock-api.ts */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm start',
    cwd: '../frontend',
    port: Number(frontendPort),
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: frontendPort,
      BROWSER: 'none',
      CI: 'true',
      REACT_APP_TOTEMDIGITAL_COMPACT: 'true',
    },
  },
});
