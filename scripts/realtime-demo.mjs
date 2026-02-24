import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local if needed (no extra deps)
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
  console.error('Veuillez définir NEXT_PUBLIC_SUPABASE_URL et une clé (SUPABASE_SERVICE_ROLE ou NEXT_PUBLIC_SUPABASE_ANON_KEY) dans .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

// Default to the demo live id that was inserted earlier
const DEFAULT_LIVE_ID = '754d3807-df07-4fd6-8e59-551b93d34138'
const LIVE_ID = process.env.DEMO_LIVE_ID || DEFAULT_LIVE_ID
const channelName = `live:${LIVE_ID}:overlays`

async function run() {
  console.log('Creating channel:', channelName)
  const channel = supabase.channel(channelName, { config: { broadcast: { ack: true } } })

  let received = false

  channel.on('broadcast', { event: 'overlay_added' }, (payload) => {
    console.log('Received broadcast event:', payload)
    received = true
  })

  const status = await channel.subscribe()
  console.log('Subscribe status:', status)

  // small delay to ensure subscription is established
  await new Promise((r) => setTimeout(r, 500))

  console.log('Sending broadcast event overlay_added...')
  try {
    const sendRes = await channel.send({
      type: 'broadcast',
      event: 'overlay_added',
      payload: { hello: 'world', ts: new Date().toISOString() },
    })
    console.log('Send result:', sendRes)
  } catch (err) {
    console.error('Erreur en envoyant broadcast:', err)
  }

  // wait up to 3s for the listener to receive
  const start = Date.now()
  while (!received && Date.now() - start < 3000) {
    await new Promise((r) => setTimeout(r, 100))
  }

  if (!received) console.warn('Broadcast non reçu dans le délai imparti.')
  else console.log('Broadcast bien reçu par le listener.')

  await supabase.removeChannel(channel)
  process.exit(received ? 0 : 1)
}

run()
