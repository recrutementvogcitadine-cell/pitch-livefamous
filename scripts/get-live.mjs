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
const LIVE_ID = process.argv[2] || process.env.DEMO_LIVE_ID || '754d3807-df07-4fd6-8e59-551b93d34138'

async function run() {
  try {
    const { data, error } = await supabase.from('lives').select('*').eq('id', LIVE_ID).maybeSingle()
    if (error) {
      console.error('Erreur Supabase:', error)
      process.exit(1)
    }
    console.log('DB record:')
    console.log(JSON.stringify(data, null, 2))
    process.exit(0)
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(1)
  }
}

run()
