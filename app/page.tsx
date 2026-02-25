import Link from "next/link";

export default function Home() {
  return (
    <main style={{padding:24,fontFamily:'system-ui, sans-serif'}}>
      <h1 style={{fontSize:28}}>Famous AI — Accueil</h1>
      <p style={{maxWidth:720}}>Bienvenue sur Famous AI — page d'accueil minimalisée pour le projet. Utilisez les liens ci‑dessous pour accéder aux démos et outils.</p>
      <ul>
        <li><Link href="/agora-test">Démo Agora (test client-side)</Link></li>
        <li><Link href="/supabase-test">Supabase test (données seeded)</Link></li>
      </ul>
      <section style={{marginTop:24}}>
        <h2>À propos</h2>
        <p>Famous AI combine vidéo en temps réel et données temps réel via Supabase.</p>
      </section>
    </main>
  );
}
