import Image from "next/image";
import Link from "next/link";
import LiveHeroStats from "./components/LiveHeroStats";

export default function HomePage() {
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 520px at 50% 30%, rgba(147,51,234,0.25), rgba(2,6,23,0.95)), linear-gradient(180deg, #020617 0%, #0b0423 50%, #020617 100%)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        padding: "16px 14px 32px",
      }}
    >
      <header
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          borderRadius: 20,
          border: "1px solid rgba(99,102,241,0.25)",
          background: "rgba(2,6,23,0.75)",
          backdropFilter: "blur(8px)",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/famous-ai-logo.svg" alt="PitchCI" width={40} height={40} style={{ borderRadius: 10 }} priority />
          <strong style={{ fontSize: 48, lineHeight: 1 }}>PitchCI</strong>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/famous-ai" style={{ color: "#e2e8f0", textDecoration: "none", fontWeight: 700, padding: "10px 12px" }}>
            Famous AI
          </Link>
          <Link href="/auth" style={{ color: "#e2e8f0", textDecoration: "none", fontWeight: 600, padding: "10px 12px" }}>
            Connexion
          </Link>
          <Link
            href="/auth?mode=signup"
            style={{
              borderRadius: 999,
              padding: "10px 18px",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              background: "linear-gradient(90deg, #f97316, #ec4899)",
              boxShadow: "0 8px 20px rgba(236,72,153,0.35)",
            }}
          >
            S&apos;inscrire
          </Link>
        </nav>
      </header>

      <section
        style={{
          maxWidth: 1100,
          margin: "18px auto 0",
          borderRadius: 24,
          padding: "22px 14px 28px",
          textAlign: "center",
          background:
            "radial-gradient(860px 420px at 50% 45%, rgba(236,72,153,0.16), rgba(15,23,42,0.55)), rgba(2,6,23,0.35)",
          border: "1px solid rgba(168,85,247,0.22)",
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: "fit-content",
            maxWidth: "100%",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.35)",
            background: "rgba(15,23,42,0.75)",
            padding: "9px 16px",
            color: "#d1d5db",
            fontWeight: 600,
            fontSize: "clamp(16px, 3.6vw, 22px)",
          }}
        >
          🟢 Plateforme de live streaming en Côte d&apos;Ivoire
        </div>

        <h1 style={{ margin: "22px 0 12px", fontSize: "clamp(42px, 9vw, 76px)", lineHeight: 1.08, fontWeight: 800 }}>
          Partagez votre
          <br />
          <span style={{ background: "linear-gradient(90deg, #fb923c, #ec4899, #a855f7)", WebkitBackgroundClip: "text", color: "transparent" }}>
            talent en direct
          </span>
        </h1>
        <p style={{ margin: "0 auto", maxWidth: 860, color: "#cbd5e1", fontSize: "clamp(18px, 3.6vw, 26px)", lineHeight: 1.42 }}>
          PitchCI est la première plateforme ivoirienne de live streaming. Créez du contenu, interagissez avec votre audience en temps réel et monétisez votre passion.
        </p>

        <div style={{ marginTop: 26, display: "grid", gap: 12, maxWidth: 780, marginInline: "auto" }}>
          <Link
            href="/famous-ai"
            style={{
              borderRadius: 999,
              padding: "16px 20px",
              border: "1px solid rgba(236,72,153,0.5)",
              color: "#f9a8d4",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "clamp(18px, 3.4vw, 36px)",
              background: "rgba(88,28,135,0.3)",
            }}
          >
            ✦ Ouvrir Famous AI
          </Link>
          <Link
            href="/watch"
            style={{
              borderRadius: 999,
              padding: "16px 20px",
              background: "linear-gradient(90deg, #f97316, #ec4899, #9333ea)",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: "clamp(20px, 5vw, 50px)",
            }}
          >
            ● Démarrer un Live
          </Link>
          <Link
            href="/lives"
            style={{
              borderRadius: 999,
              padding: "16px 20px",
              border: "1px solid rgba(148,163,184,0.35)",
              color: "#e2e8f0",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "clamp(20px, 5vw, 50px)",
              background: "rgba(15,23,42,0.4)",
            }}
          >
            ◉ Découvrir
          </Link>
        </div>

        <LiveHeroStats />

        {!supabaseConfigured ? (
          <div
            style={{
              margin: "28px auto 0",
              maxWidth: 780,
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.55)",
              background: "rgba(30,64,175,0.55)",
              color: "#bfdbfe",
              padding: "12px 14px",
              fontWeight: 700,
              textAlign: "left",
            }}
          >
            🔵 Supabase non configuré — Mode démo actif
          </div>
        ) : null}

      </section>
    </main>
  );
}
