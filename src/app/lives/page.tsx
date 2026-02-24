import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type LiveRow = { id: string; title?: string | null }

export default async function LivesIndex() {
  const supabase = await createClient()

  let data: LiveRow[] | null = null
  let fetchError: unknown = null

  try {
    const res = await supabase.from('lives').select('id, title').limit(20)
    data = res.data as LiveRow[]
    fetchError = res.error ?? null
  } catch (err) {
    fetchError = err
  }

  if (fetchError) {
    let message = String(fetchError)
    if (typeof fetchError === 'object' && fetchError !== null && 'message' in fetchError) {
      const m = (fetchError as { message?: unknown }).message
      if (m !== undefined) message = String(m)
    }
    return (
      <main style={{ padding: 24 }}>
        <pre>Erreur Supabase: {message}</pre>
      </main>
    )
  }

  if (!data || data.length === 0) {
    return (
      <main style={{ padding: 24 }}>
        <p>Aucun live trouvé.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Lives</h1>
      <ul>
        {data.map((row) => (
          <li key={row.id}>
            <Link href={`/lives/${row.id}`}>{row.title ?? row.id}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
