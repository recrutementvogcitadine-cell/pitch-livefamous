import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function LivesIndex() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('lives')
      .select('id, title')
      .limit(20)

    if (error) {
      return (
        <main style={{ padding: 24 }}>
          <pre>Erreur Supabase: {error.message}</pre>
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
          {data.map((row: any) => (
            <li key={row.id}>
              <Link href={`/lives/${row.id}`}>{row.title ?? row.id}</Link>
            </li>
          ))}
        </ul>
      </main>
    )
  } catch (err: any) {
    return (
      <main style={{ padding: 24 }}>
        <pre>Erreur: {String(err?.message ?? err)}</pre>
      </main>
    )
  }
}
