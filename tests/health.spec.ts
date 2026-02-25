import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://pitch-livefamous.vercel.app'

test('GET /api/health returns ok', async ({ request }) => {
  const res = await request.get(`${BASE}/api/health`)
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.ok).toBe(true)
})

test('Page /supabase-test renders latest seeded live', async ({ page }) => {
  await page.goto(`${BASE}/supabase-test`)
  // wait for client JS to render the demo title
  await page.waitForTimeout(1000)
  const content = await page.textContent('body')
  expect(content).toContain('Demo live')
})
