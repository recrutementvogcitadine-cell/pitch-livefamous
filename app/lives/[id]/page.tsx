import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type LiveRecord = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  [key: string]: unknown;
};

type PageParams = { id?: string } | Promise<{ id?: string }>;

export default async function LiveDetailsPage({ params }: { params: PageParams }) {
  const resolved = await params;
  const id = resolved?.id;

  if (!id) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>ID de live manquant.</p>
        <Link href="/lives">Retour à la liste</Link>
      </main>
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Configuration Supabase manquante.</p>
        <Link href="/lives">Retour à la liste</Link>
      </main>
    );
  }

  const client = createClient(url, key);
  const { data, error } = await client.from("lives").select("*").eq("id", id).maybeSingle();

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Erreur: {error.message}</p>
        <Link href="/lives">Retour à la liste</Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Live introuvable.</p>
        <Link href="/lives">Retour à la liste</Link>
      </main>
    );
  }

  const live = data as LiveRecord;

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <Link href="/lives" style={{ color: "#1d4ed8", textDecoration: "none" }}>
        ← Retour à la liste des lives
      </Link>

      <h1 style={{ marginBottom: 6 }}>{live.title ?? "Live sans titre"}</h1>
      <p style={{ marginTop: 0, color: "#6b7280" }}>
        Statut: {live.status ?? "inconnu"} · {live.created_at ? new Date(live.created_at).toLocaleString("fr-FR") : "Date inconnue"}
      </p>

      <section style={{ border: "1px solid #dbeafe", borderRadius: 12, padding: 14, background: "#fff" }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Données du live</h2>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(live, null, 2)}</pre>
      </section>
    </main>
  );
}
