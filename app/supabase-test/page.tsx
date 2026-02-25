"use client"

import * as React from 'react'
import { createClient } from '@supabase/supabase-js'

export default function SupabaseTestPage() {
  const [state, setState] = React.useState<{ loading: boolean; ok?: boolean; error?: string | null; sample?: unknown[] | null }>({ loading: true })

  React.useEffect(() => {
    ;(async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !key) {
        setState({ loading: false, ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY' })
        return
      }

      const client = createClient(url, key)

      try {
        // Query the most-recent seeded live
        const { data, error } = await client.from('lives').select('id,creator_id,title,status,created_at').order('created_at', { ascending: false }).limit(1)
        setState({ loading: false, ok: !error, error: error?.message ?? null, sample: data ?? null })
      } catch (err: unknown) {
        let msg: string
        if (err instanceof Error) msg = err.message
        else msg = String(err)
        setState({ loading: false, ok: false, error: msg })
      }
    })()
  }, [])

  if (state.loading) return <div style={{ padding: 16 }}>Loading...</div>
  if (!state.ok) return <div style={{ padding: 16, color: 'crimson' }}>Error: {state.error}</div>

  return (
    <div style={{ padding: 16 }}>
      <h2>Supabase test — latest `lives` record</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12 }}>{JSON.stringify(state.sample, null, 2)}</pre>
    </div>
  )
}
