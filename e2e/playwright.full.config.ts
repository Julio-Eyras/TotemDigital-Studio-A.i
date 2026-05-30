import { defineConfig, devices } from '@playwright/test';

const backendPort = process.env.E2E_BACKEND_PORT || '3000';
const frontendPort = process.env.E2E_FRONTEND_PORT || '3001';
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${frontendPort}`;

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://smartsignage:smartsignage123@127.0.0.1:5433/smartsignage';

/** Modo full — Postgres (Docker) + backend + frontend */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup.ts'),
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      port: Number(backendPort),
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: 'development',
        PORT: backendPort,
        HOST: '127.0.0.1',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-jwt-secret-minimum-32-chars-long',
        TOTEMDIGITAL_COMPACT: 'true',
        CACHE_ENABLED: 'false',
        SMARTDISPLAYFX_MQTT_ENABLED: 'false',
        CORS_ORIGIN: `http://127.0.0.1:${frontendPort},http://localhost:${frontendPort}`,
        LOG_LEVEL: 'warn',
      },
    },
    {
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
  ],
});
