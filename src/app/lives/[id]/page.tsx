import { createClient } from '@/lib/supabase/server'

type PageParams = { id?: string } | Promise<{ id?: string }>

export default async function Page({ params }: { params: PageParams }) {
  const resolvedParams = await params
  const id = resolvedParams?.id
  // validate UUID to avoid database errors when id is not a uuid
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!id || !uuidRegex.test(id)) {
    return (
      <main style={{ padding: 24 }}>
        <p>ID invalide : {id ?? 'null'}</p>
      </main>
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lives')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <pre>Erreur: {error.message}</pre>
      </main>
    )
  }

  if (!data) {
    return (
      <main style={{ padding: 24 }}>
          <p>Aucun enregistrement pour id: {id}</p>
        </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
        <h1>Live: {data.title ?? id}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  )
}
