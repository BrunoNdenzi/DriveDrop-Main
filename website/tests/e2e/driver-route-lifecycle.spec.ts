import { expect, test } from '@playwright/test'

const email = process.env.E2E_DRIVER_ROUTE_EMAIL
const password = process.env.E2E_DRIVER_ROUTE_PASSWORD

test.skip(!email || !password, 'Driver route lifecycle credentials are required')

test('saved driver routes and operations are usable on desktop and mobile widths', async ({ page }) => {
  test.setTimeout(120_000)
  const appUrl = process.env.E2E_ROUTE_PLANNER_URL || ''
  const driverRouteApi = process.env.E2E_DRIVER_ROUTE_API
  if (driverRouteApi) {
    await page.route('**/api/v1/driver-routes/**', async route => {
      const requestUrl = new URL(route.request().url())
      const suffix = requestUrl.pathname.split('/api/v1/driver-routes')[1] ?? ''
      const response = await route.fetch({ url: `${driverRouteApi}${suffix}${requestUrl.search}` })
      await route.fulfill({ response })
    })
  }
  const login = await page.request.post(`${appUrl}/api/auth/login`, {
    data: { email, password, role: 'driver', redirectTo: '/dashboard/driver/route-planner' },
  })
  expect(login.ok(), await login.text()).toBe(true)

  await page.goto(`${appUrl}/dashboard/driver/route-planner`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/dashboard\/driver\/route-planner$/, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Routes & Operations' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Routes & Operations' }).click()

  await expect(page.getByText('Saved route', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Latest execution' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Version history' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'JSON' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share' })).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }))
    expect(pageWidth.scroll, JSON.stringify({ viewport, pageWidth })).toBeLessThanOrEqual(pageWidth.client)
  }
})
