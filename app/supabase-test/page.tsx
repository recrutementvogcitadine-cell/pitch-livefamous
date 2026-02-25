"use client"

import * as React from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export default function SupabaseTestPage() {
  const [state, setState] = React.useState<{ loading?: boolean; ok?: boolean; error?: string | null; sample?: any }>({ loading: true })
  const [supabase, setSupabase] = React.useState<SupabaseClient | null>(null)

  React.useEffect(() => {
    ;(async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !key) {
        setState({ loading: false, ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' })
        return
      }

      const client = createClient(url, key)
      setSupabase(client)

      try {
        // Remplace 'public_table' par une table réellement lisible par ton client
        const { data, error } = await client.from('public_table').select('*').limit(1)
        setState({ loading: false, ok: !error, error: error?.message ?? null, sample: data })
      } catch (err: any) {
        setState({ loading: false, ok: false, error: err?.message ?? String(err) })
      }
    })()
  }, [])

  return <pre style={{ padding: 16 }}>{JSON.stringify(state, null, 2)}</pre>
}
