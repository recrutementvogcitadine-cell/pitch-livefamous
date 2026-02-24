import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

// Load .env.local if needed
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return
        const idx = trimmed.indexOf('=')
        if (idx === -1) return
        const key = trimmed.slice(0, idx)
        const val = trimmed.slice(idx + 1)
        if (!process.env[key]) process.env[key] = val
      })
    }
  } catch {
    // ignore
  }
}

const BASE = process.env.DEV_BASE_URL || 'http://localhost:3000'
const LIVE_ID = process.env.DEMO_LIVE_ID || '754d3807-df07-4fd6-8e59-551b93d34138'

async function run() {
  fs.mkdirSync('videos', { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: path.join(process.cwd(), 'videos'), size: { width: 1280, height: 720 } },
  })

  const page = await context.newPage()

  console.log('Recording: visiting index')
  await page.goto(`${BASE}/lives`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  console.log('Recording: visiting detail')
  await page.goto(`${BASE}/lives/${LIVE_ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  await page.close()

  // Close context/browser then pick the most recent .webm in videos/ (handles Windows file locks)
  await context.close()
  await browser.close()

  const vids = fs.readdirSync('videos').filter((f) => f.endsWith('.webm'))
  if (vids.length === 0) throw new Error('No video file found in videos/')
  const files = vids.map((f) => ({ f, m: fs.statSync(path.join('videos', f)).mtimeMs }))
  files.sort((a, b) => b.m - a.m)
  const src = path.join('videos', files[0].f)
  const dest = path.join('videos', `demo-${Date.now()}.webm`)

  // Retry rename a few times in case the file is still being released by ffmpeg
  let attempts = 0
  while (attempts < 10) {
    try {
      fs.renameSync(src, dest)
      break
    } catch {
      attempts += 1
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  if (attempts >= 10) throw new Error('Failed to move video file after retries')

  console.log('Saved video to', dest)
}

run().catch((e) => {
  console.error('Recording failed:', e)
  process.exit(1)
})
