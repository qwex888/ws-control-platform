import { expect, test } from '@playwright/test'
import { loginIfNeeded } from './_auth'

test('login -> shell -> refresh keeps shell state visible', async ({ page }) => {
  await loginIfNeeded(page)

  await expect(page.getByText('WS Control')).toBeVisible()
  await expect(page.getByText('控制面板')).toBeVisible()

  await page.reload()
  await expect(page.getByText('WS Control')).toBeVisible()
  await expect(page.locator('[aria-label="Device canvas"]')).toBeVisible()
})
