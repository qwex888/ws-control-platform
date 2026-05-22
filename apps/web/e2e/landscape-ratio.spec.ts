import { expect, test } from '@playwright/test'
import { loginIfNeeded } from './_auth'

test('device canvas area is visible with correct layout', async ({ page }) => {
  await loginIfNeeded(page)

  const canvas = page.locator('[aria-label="Device canvas"]')
  await expect(canvas).toBeVisible()

  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  }
})
