import { expect, test } from '@playwright/test'

const email = process.env.E2E_ROUTE_PLANNER_EMAIL
const password = process.env.E2E_ROUTE_PLANNER_PASSWORD

test.skip(!email || !password, 'E2E route planner credentials are required')

test('route planner operations and billing are usable on desktop and mobile', async ({ page }) => {
  test.setTimeout(120_000)
  const appUrl = process.env.E2E_ROUTE_PLANNER_URL || ''
  const login = await page.request.post(`${appUrl}/api/auth/login`, {
    data: { email, password, role: 'client', redirectTo: '/route-planner' },
  })
  expect(login.ok(), await login.text()).toBe(true)
  await page.goto(`${appUrl}/route-planner`, { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/route-planner$/, { timeout: 30_000 })
  const setup = page.getByRole('heading', { name: 'Set your planning defaults' })
  const needsSetup = await setup.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)
  if (needsSetup) {
    await page.getByRole('button', { name: 'Open route planner' }).click()
  }

  await expect(page.getByRole('button', { name: 'Operations' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Operations' }).click()
  await expect(page.getByText('Operational route')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Latest execution' })).toBeVisible()
  await expect(page.getByText('Route not found', { exact: true })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Version history' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'JSON' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Share tracking' })).toBeVisible()
  await expect(page.getByText('Online', { exact: true })).toBeVisible()

  for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(overflow.scrollWidth, JSON.stringify({ viewport, ...overflow })).toBeLessThanOrEqual(overflow.clientWidth)
    const overlaps = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('button,input,select,textarea')]
        .map(element => ({ name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, rect: element.getBoundingClientRect() }))
        .filter(item => item.rect.width > 0 && item.rect.height > 0)
      const pairs: string[][] = []
      for (let left = 0; left < controls.length; left += 1) {
        for (let right = left + 1; right < controls.length; right += 1) {
          const a = controls[left]!
          const b = controls[right]!
          if (a.rect.left < b.rect.right && a.rect.right > b.rect.left && a.rect.top < b.rect.bottom && a.rect.bottom > b.rect.top) {
            pairs.push([a.name, b.name])
          }
        }
      }
      return pairs
    })
    expect(overlaps).toEqual([])
  }

  await page.getByRole('button', { name: 'Billing' }).click()
  await expect(page.getByText('Current plan', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Starter' }).first()).toBeVisible()
  await expect(page.getByText(/Starter trial ends/)).toBeVisible()
  await expect(page.getByText('Routes this month')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose Pro' })).toBeVisible()
  const billingWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(billingWidth.scroll).toBeLessThanOrEqual(billingWidth.client)
})
