import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  creator_id: string | null;
};

type PageParams = { id?: string } | Promise<{ id?: string }>;

export default async function CreatorProfilePage({ params }: { params: PageParams }) {
  const resolved = await params;
  const creatorId = resolved?.id?.trim();

  if (!creatorId) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Profil créateur introuvable.</p>
        <Link href="/watch">Retour watch</Link>
      </main>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Configuration serveur manquante.</p>
        <Link href="/watch">Retour watch</Link>
      </main>
    );
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [liveRes, historyRes, scheduleRes] = await Promise.all([
    admin
      .from("lives")
      .select("id,title,status,created_at,creator_id")
      .eq("creator_id", creatorId)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("lives")
      .select("id,title,status,created_at,creator_id")
      .eq("creator_id", creatorId)
      .neq("status", "live")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("creator_live_schedule")
      .select("next_live_at,announcement")
      .eq("creator_user_id", creatorId)
      .maybeSingle(),
  ]);

  if (liveRes.error || historyRes.error || scheduleRes.error) {
    const message = liveRes.error?.message ?? historyRes.error?.message ?? scheduleRes.error?.message ?? "Impossible de charger ce profil.";
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <p>Erreur: {message}</p>
        <Link href="/watch">Retour watch</Link>
      </main>
    );
  }

  const currentLive = (liveRes.data ?? [])[0] ?? null;
  const oldLives = historyRes.data ?? [];
  const nextLiveAt = scheduleRes.data?.next_live_at ?? null;
  const announcement = scheduleRes.data?.announcement ?? "";

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href="/watch" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }}>
          ← Retour watch
        </Link>
        <span style={{ borderRadius: 999, padding: "6px 10px", background: "#dbeafe", color: "#1e3a8a", fontWeight: 800, fontSize: 12 }}>
          PROFIL CRÉATEUR
        </span>
      </div>

      <h1 style={{ marginBottom: 8 }}>@{creatorId.slice(0, 8)}</h1>

      {currentLive ? (
        <section style={highlightCardStyle}>
          <h2 style={{ margin: 0 }}>En live maintenant 🔴</h2>
          <p style={{ margin: 0, color: "#334155" }}>{currentLive.title ?? "Live sans titre"}</p>
          <Link href={`/watch?startLiveId=${encodeURIComponent(currentLive.id)}`} style={primaryActionStyle}>
            Rejoindre ce live
          </Link>
          <Link href="/watch" style={secondaryActionStyle}>
            Ouvrir le flux live (scroll)
          </Link>
        </section>
      ) : (
        <section style={cardStyle}>
          <h2 style={{ margin: 0 }}>Créateur hors ligne</h2>
          <p style={{ margin: 0, color: "#475569" }}>Ce créateur n&apos;est pas en live pour le moment.</p>
          <Link href="/watch" style={secondaryActionStyle}>
            Voir les lives en cours
          </Link>
        </section>
      )}

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>Prochain live annoncé</h2>
        {nextLiveAt ? (
          <>
            <p style={{ margin: 0, color: "#0f172a", fontWeight: 700 }}>
              {new Date(nextLiveAt).toLocaleString("fr-FR")}
            </p>
            <p style={{ margin: 0, color: "#334155" }}>{announcement || "Le créateur sera bientôt en direct."}</p>
          </>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>Aucune annonce de prochain live pour le moment.</p>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: 0 }}>Anciens lives</h2>
        {oldLives.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>Aucun ancien live disponible.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {oldLives.map((live) => (
              <li key={live.id} style={oldLiveItemStyle}>
                <div style={{ display: "grid", gap: 2 }}>
                  <strong>{live.title ?? "Live sans titre"}</strong>
                  <small style={{ color: "#64748b" }}>
                    {live.created_at ? new Date(live.created_at).toLocaleString("fr-FR") : "Date inconnue"}
                  </small>
                </div>
                <Link href={`/lives/${live.id}`} style={secondaryActionStyle}>
                  Voir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const cardStyle = {
  marginTop: 12,
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 8,
};

const highlightCardStyle = {
  ...cardStyle,
  border: "1px solid #fda4af",
  background: "#fff1f2",
};

const primaryActionStyle = {
  display: "inline-flex",
  width: "fit-content",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#dc2626",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 800,
};

const secondaryActionStyle = {
  display: "inline-flex",
  borderRadius: 10,
  padding: "8px 11px",
  background: "#e2e8f0",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 700,
};

const oldLiveItemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  padding: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};
