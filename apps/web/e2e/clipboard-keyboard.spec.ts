import { expect, test } from '@playwright/test'
import { loginIfNeeded } from './_auth'

test('clipboard controls and keyboard-focus canvas are available', async ({ page }) => {
  await loginIfNeeded(page)

  await expect(page.getByText('剪贴板同步')).toBeVisible()
  await expect(page.getByText('全局同步')).toBeVisible()

  const canvas = page.locator('[aria-label="Device canvas"]')
  await canvas.click()
  await page.keyboard.press('Enter')

  await expect(page.getByText('已启用')).toBeVisible()
})
