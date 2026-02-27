"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAppLogo } from "../../components/app-logo";

type EscalationStatus = "open" | "resolved";

type EscalationRow = {
  id: string;
  live_id: string;
  user_id: string;
  question: string;
  reason: string;
  status?: EscalationStatus;
  resolution_note?: string | null;
  resolved_by?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export default function ModerationPage() {
  const appLogo = useAppLogo();
  const [status, setStatus] = useState<EscalationStatus>("open");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<EscalationRow[]>([]);

  const title = useMemo(
    () => (status === "open" ? "Escalades ouvertes" : "Escalades résolues"),
    [status]
  );

  const loadRows = async (nextStatus: EscalationStatus) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/live-ai/escalations?status=${nextStatus}`);
      const body = (await response.json()) as { escalations?: EscalationRow[]; error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Impossible de charger les escalades.");
      }

      setRows(Array.isArray(body.escalations) ? body.escalations : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows(status);
  }, [status]);

  const updateEscalation = async (row: EscalationRow, nextStatus: EscalationStatus) => {
    setSavingId(row.id);
    setError(null);
    try {
      const resolutionNote =
        nextStatus === "resolved"
          ? "Traité via dashboard modération"
          : "Réouvert via dashboard modération";

      const response = await fetch("/api/live-ai/escalations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          status: nextStatus,
          resolutionNote,
        }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Mise à jour impossible.");
      }

      await loadRows(status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/settings" style={backStyle}>
          ← Retour paramètres
        </Link>

        <h1 style={{ margin: 0 }}>Dashboard modération Live IA</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={appLogo} alt="Logo app" width={38} height={38} style={{ borderRadius: 10, border: "1px solid #bfdbfe", background: "#fff" }} />
          <span style={{ color: "#1e3a8a", fontWeight: 700, fontSize: 13 }}>Dashboard Modération</span>
        </div>
        <p style={{ margin: 0, color: "#475569" }}>
          Suivi des questions escaladées vers modération humaine.
        </p>

        <section style={shortcutCardStyle}>
          <strong style={{ color: "#0f172a" }}>Raccourcis actions</strong>
          <div style={shortcutGridStyle}>
            <Link href="/settings/admin" style={shortcutPrimaryStyle}>Dashboard admin</Link>
            <Link href="/watch" style={shortcutDarkStyle}>Watch live</Link>
            <Link href="/lives" style={shortcutDarkStyle}>Tous les lives</Link>
            <Link href="/api/live-ai/escalations?status=open" style={shortcutDarkStyle}>API escalades ouvertes</Link>
            <Link href="/api/live-ai/escalations?status=resolved" style={shortcutDarkStyle}>API escalades résolues</Link>
          </div>
        </section>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setStatus("open")}
            style={{ ...pillBtnStyle, background: status === "open" ? "#1d4ed8" : "#e2e8f0", color: status === "open" ? "#fff" : "#0f172a" }}
          >
            Ouvertes
          </button>
          <button
            type="button"
            onClick={() => setStatus("resolved")}
            style={{ ...pillBtnStyle, background: status === "resolved" ? "#1d4ed8" : "#e2e8f0", color: status === "resolved" ? "#fff" : "#0f172a" }}
          >
            Résolues
          </button>
          <button type="button" onClick={() => void loadRows(status)} style={pillBtnStyle}>
            Rafraîchir
          </button>
        </div>

        <h2 style={{ margin: "8px 0 0" }}>{title}</h2>

        {loading ? <p style={{ margin: 0 }}>Chargement...</p> : null}
        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>Erreur: {error}</p> : null}

        {!loading && !rows.length ? (
          <p style={{ margin: 0, color: "#64748b" }}>Aucune escalade trouvée.</p>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <article key={row.id} style={itemStyle}>
              <div style={{ display: "grid", gap: 4 }}>
                <strong>Live: {row.live_id}</strong>
                <span style={{ color: "#475569", fontSize: 13 }}>Raison: {row.reason}</span>
                <span style={{ color: "#475569", fontSize: 13 }}>
                  Créé: {new Date(row.created_at).toLocaleString("fr-FR")}
                </span>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{row.question}</p>
                {row.resolution_note ? (
                  <small style={{ color: "#334155" }}>Note: {row.resolution_note}</small>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {status === "open" ? (
                  <button
                    onClick={() => void updateEscalation(row, "resolved")}
                    disabled={savingId === row.id}
                    style={resolveBtnStyle}
                  >
                    {savingId === row.id ? "..." : "Marquer résolue"}
                  </button>
                ) : (
                  <button
                    onClick={() => void updateEscalation(row, "open")}
                    disabled={savingId === row.id}
                    style={reopenBtnStyle}
                  >
                    {savingId === row.id ? "..." : "Rouvrir"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => void loadRows(status)}
        style={floatingRefreshStyle}
        aria-label="Rafraîchir les escalades"
      >
        Rafraîchir
      </button>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#eff6ff",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 20,
  display: "grid",
  gap: 12,
};

const backStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 700,
  textDecoration: "none",
};

const pillBtnStyle: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "8px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const itemStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  display: "grid",
  gap: 10,
};

const shortcutCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 10,
  display: "grid",
  gap: 8,
};

const shortcutGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
};

const shortcutBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: 12,
};

const shortcutPrimaryStyle: CSSProperties = {
  ...shortcutBaseStyle,
  background: "#1d4ed8",
  color: "#fff",
};

const shortcutDarkStyle: CSSProperties = {
  ...shortcutBaseStyle,
  background: "#0f172a",
  color: "#fff",
};

const resolveBtnStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#15803d",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const reopenBtnStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const floatingRefreshStyle: CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 40,
  border: "none",
  borderRadius: 999,
  padding: "10px 14px",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.25)",
};
