import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Try to load .env.local if vars are not present
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
// Prefer service role for admin operations (safer for seeding); fall back to anon if provided
const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Veuillez définir NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) et une clé (SUPABASE_SERVICE_ROLE ou NEXT_PUBLIC_SUPABASE_ANON_KEY) dans .env.local')
  process.exit(1)
}

const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE)
if (usingServiceRole) console.log('Using SUPABASE_SERVICE_ROLE for seeding (recommended).')
else console.log('Using anon key for seeding (may be blocked by Row Level Security).')

const supabase = createClient(url, key)

async function run() {
  try {
    const title = `Demo live ${new Date().toISOString()}`

    // Create a demo user (admin) and use its id as creator_id
    let creatorId = null
    try {
      const email = `demo+${Date.now()}@example.com`
      const password = `DemoPass!${Math.random().toString(36).slice(2, 10)}`
      // admin.createUser may return { data: { user } } or { data, error }
      const adminRes = await supabase.auth.admin.createUser({ email, password, email_confirm: true })
      if (adminRes?.error) {
        console.warn('Impossible de créer un utilisateur demo via admin.createUser:', adminRes.error)
      } else if (adminRes?.data?.user?.id) {
        creatorId = adminRes.data.user.id
      } else if (adminRes?.data?.id) {
        creatorId = adminRes.data.id
      }
    } catch (e) {
      console.warn('Erreur lors de la création du user demo (continuation):', String(e))
    }

    // fallback: generate a uuid if creatorId still null
    if (!creatorId) {
      try {
        creatorId = (await import('crypto')).randomUUID()
      } catch {
        creatorId = '00000000-0000-0000-0000-000000000000'
      }
      console.log('Utilisation de creator_id de fallback:', creatorId)
    }

    const payload = { title, creator_id: creatorId }
    const res = await supabase.from('lives').insert([payload]).select().single()
    if (res.error) {
      // Row-level security will return a permission error (42501)
      if (res.error.code === '42501') {
        console.error('Échec: row-level security empêche l\'insertion avec cette clé.')
        console.error('Options pour corriger (dev):')
        console.error('- Fournir la `SUPABASE_SERVICE_ROLE` key dans votre .env.local et relancer ce script.')
        console.error("  Ajoutez dans .env.local:\n    SUPABASE_SERVICE_ROLE=la_cle_service_role")
        console.error('- OU créer une policy SQL temporaire pour autoriser les inserts (dev only). Exemple SQL à exécuter dans Supabase SQL editor:')
        console.error(`\n-- Permettre insert (DEV seulement)\nCREATE POLICY \"Allow inserts for dev\" ON public.lives\n  FOR INSERT\n  USING (true)\n  WITH CHECK (true);\n\n-- Si RLS n\'est pas activé, activez-le:\nALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;\n`)
        process.exit(1)
      }

      console.error('Erreur insertion:', res.error)
      process.exit(1)
    }
    console.log('Enregistrement inséré:', res.data)
    process.exit(0)
  } catch (err) {
    console.error('Erreur:', err)
    process.exit(1)
  }
}

run()
