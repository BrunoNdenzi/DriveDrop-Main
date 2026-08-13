import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')) {
  throw new Error('Playwright payment safety check failed: Stripe publishable key is not test mode')
}

if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('Playwright payment safety check failed: Stripe secret key is not test mode')
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3100',
    cwd: __dirname,
    env: {
      ...process.env,
      E2E_STRIPE_TEST_MODE: 'true',
      NEXT_PUBLIC_MAINTENANCE_MODE: 'false',
    },
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
  },
})