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

async function runListener() {
  console.log('Listener: subscribing to', channelName)
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } })

  channel.on('broadcast', { event: 'overlay_added' }, (payload) => {
    console.log('Listener: received broadcast payload ->', payload)
  })

  const status = await channel.subscribe()
  console.log('Listener subscribe status:', status)

  // keep process alive for 15s so we can run the broadcaster
  console.log('Listener active for 15s, waiting for broadcasts...')
  setTimeout(async () => {
    console.log('Listener: exiting and removing channel')
    await supabase.removeChannel(channel)
    process.exit(0)
  }, 15000)
}

runListener()
