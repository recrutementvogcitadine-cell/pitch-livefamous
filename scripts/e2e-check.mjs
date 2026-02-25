import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'https://pitch-livefamous.vercel.app'

async function checkHealth() {
  const res = await fetch(`${BASE}/api/health`)
  if (!res.ok) throw new Error(`health status ${res.status}`)
  const body = await res.json()
  if (!body.ok) throw new Error('health ok not true')
  console.log('health OK')
}

async function checkSupabaseTest() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${BASE}/supabase-test`, { waitUntil: 'networkidle' })
  // wait a bit for client JS to render
  await page.waitForTimeout(1000)
  const text = await page.textContent('body')
  await browser.close()
  if (!text) throw new Error('empty page body')
  if (!text.includes('Demo live') && !text.includes('title')) throw new Error('seeded record not found in supabase-test')
  console.log('supabase-test OK')
}

;(async () => {
  try {
    await checkHealth()
    await checkSupabaseTest()
    console.log('E2E checks passed')
    process.exit(0)
  } catch (e) {
    console.error('E2E check failed:', e)
    process.exit(1)
  }
})()
