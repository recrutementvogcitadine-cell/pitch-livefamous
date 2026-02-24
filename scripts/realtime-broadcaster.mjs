import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Veuillez définir NEXT_PUBLIC_SUPABASE_URL et une clé dans .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)
const LIVE_ID = process.env.DEMO_LIVE_ID || '754d3807-df07-4fd6-8e59-551b93d34138'
const channelName = `live:${LIVE_ID}:overlays`

async function sendBroadcast() {
  console.log('Broadcaster: preparing to send to', channelName)
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } })

  // No need to subscribe here; just send a broadcast
  try {
    const res = await channel.send({
      type: 'broadcast',
      event: 'overlay_added',
      payload: { demo: true, ts: new Date().toISOString() },
    })
    console.log('Broadcaster send result:', res)
  } catch (err) {
    console.error('Broadcaster error sending:', err)
  }

  process.exit(0)
}

sendBroadcast()
