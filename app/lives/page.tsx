"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 12;

export default function LivesPage() {
  const [lives, setLives] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showingLiveOnly, setShowingLiveOnly] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const loadPage = async (nextOffset: number, append: boolean, liveOnly: boolean) => {
    if (!client) {
      throw new Error("Variables Supabase manquantes.");
    }

    const query = client
      .from("lives")
      .select("id,title,status,created_at")
      .order("created_at", { ascending: false })
      .range(nextOffset, nextOffset + PAGE_SIZE - 1);

    const { data, error: queryError } = liveOnly ? await query.eq("status", "live") : await query;

    if (queryError) {
      throw queryError;
    }

    const rows = (data ?? []) as LiveRow[];
    setLives((prev) => (append ? [...prev, ...rows] : rows));
    setOffset(nextOffset + rows.length);
    setHasMore(rows.length === PAGE_SIZE);
    setShowingLiveOnly(liveOnly);
    return rows.length;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      if (!client) {
        setError("Variables Supabase manquantes.");
        setLoading(false);
        return;
      }

      try {
        const { data } = await client.auth.getUser();
        if (!data.user) {
          window.location.href = "/auth";
          return;
        }

        const liveCount = await loadPage(0, false, true);
        if (liveCount === 0) {
          await loadPage(0, false, false);
        }
      } catch (err: unknown) {
        setError(toDisplayErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await loadPage(offset, true, showingLiveOnly);
    } catch (err: unknown) {
      setError(toDisplayErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const onSignOut = async () => {
    if (!client || signingOut) return;
    setSigningOut(true);
    try {
      await client.auth.signOut();
    } finally {
      window.location.href = "/auth";
    }
  };

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 6px" }}>Lives en cours</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Les spectateurs peuvent faire défiler cette liste et ouvrir chaque live.
        </p>
      </header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href="/" style={pillStyle}>
          Retour accueil
        </Link>
        <Link href="/agora-test" style={pillStyle}>
          Ouvrir Agora test
        </Link>
        <button type="button" onClick={() => void onSignOut()} disabled={signingOut} style={pillStyleButton}>
          {signingOut ? "Déconnexion..." : "Se déconnecter"}
        </button>
      </div>

      {loading ? <p>Chargement des lives...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>Erreur: {error}</p> : null}

      {!loading && !error && lives.length === 0 ? <p>Aucun live disponible pour le moment.</p> : null}

      {!loading && lives.length > 0 ? (
        <>
          <p style={{ color: "#4b5563", marginTop: 0 }}>
            {showingLiveOnly ? "Affichage des lives avec statut live." : "Aucun statut live trouvé, affichage des derniers lives."}
          </p>

          <section
            style={{
              border: "1px solid #dbeafe",
              borderRadius: 12,
              padding: 12,
              maxHeight: "70vh",
              overflowY: "auto",
              background: "#fff",
            }}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
              {lives.map((live) => (
                <li key={live.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <strong>{live.title || "Live sans titre"}</strong>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Statut: {live.status ?? "inconnu"}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>
                        {live.created_at ? new Date(live.created_at).toLocaleString("fr-FR") : "Date indisponible"}
                      </div>
                    </div>
                    <Link href={`/lives/${live.id}`} style={pillStyle}>
                      Regarder
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div style={{ marginTop: 12 }}>
            <button onClick={loadMore} disabled={!hasMore || loadingMore} style={pillStyleButton}>
              {loadingMore ? "Chargement..." : hasMore ? "Charger plus" : "Fin de liste"}
            </button>
          </div>
        </>
      ) : null}
    </main>
  );
}

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #c7d2fe",
  color: "#1d4ed8",
  textDecoration: "none",
  background: "#eff6ff",
  fontWeight: 600,
};

const pillStyleButton: CSSProperties = {
  ...pillStyle,
  cursor: "pointer",
};

function toDisplayErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  if (err && typeof err === "object") {
    const message = Reflect.get(err, "message");
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }

    const errorDescription = Reflect.get(err, "error_description");
    if (typeof errorDescription === "string" && errorDescription.trim().length > 0) {
      return errorDescription;
    }

    const error = Reflect.get(err, "error");
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }

    try {
      const serialized = JSON.stringify(err);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {}
  }

  return "Erreur de chargement des lives.";
}
