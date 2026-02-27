"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

const actionItems = [
  {
    href: "/settings/moderation",
    title: "Modération IA",
    description: "Gérer les escalades humaines et le traitement des incidents IA.",
    tone: "primary" as const,
  },
  {
    href: "/lives",
    title: "Gestion des Lives",
    description: "Contrôler les lives actifs, vérifier la visibilité spectateur.",
    tone: "dark" as const,
  },
  {
    href: "/watch",
    title: "Expérience Spectateur",
    description: "Valider l'affichage du feed, IA Live, interactions en direct.",
    tone: "dark" as const,
  },
  {
    href: "/settings",
    title: "Configuration App",
    description: "Logo, promotions, réglages opérationnels de l'application.",
    tone: "primary" as const,
  },
];

export default function AdminDashboardPage() {
  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/settings" style={backStyle}>
            ← Retour paramètres
          </Link>
          <span style={badgeStyle}>ADMIN DASHBOARD</span>
        </div>

        <h1 style={{ margin: 0 }}>Tableau de bord administrateur</h1>
        <p style={{ margin: 0, color: "#475569" }}>
          Interface centrale pour piloter la modération, l&apos;opération live et les contrôles qualité production.
        </p>

        <section style={gridStyle}>
          {actionItems.map((item) => (
            <article key={item.href} style={panelStyle}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{item.title}</h2>
              <p style={{ margin: 0, color: "#475569", lineHeight: 1.45 }}>{item.description}</p>
              <Link href={item.href} style={item.tone === "primary" ? action3DPrimaryStyle : action3DDarkStyle}>
                Ouvrir
              </Link>
            </article>
          ))}
        </section>

        <section style={statusBoxStyle}>
          <div style={{ fontWeight: 700 }}>Contrôle rapide recommandé</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#334155" }}>
            <li>Vérifier /api/health avant toute opération</li>
            <li>Confirmer /api/agora/token pour la disponibilité RTC</li>
            <li>Tester un message IA Live sur /watch après chaque déploiement</li>
          </ul>
        </section>
      </section>
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
  maxWidth: 980,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 20,
  display: "grid",
  gap: 14,
};

const backStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 700,
  textDecoration: "none",
};

const badgeStyle: CSSProperties = {
  borderRadius: 999,
  padding: "6px 10px",
  background: "#dbeafe",
  color: "#1e3a8a",
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0.3,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 14,
  display: "grid",
  gap: 10,
};

const action3DBaseStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 800,
  textDecoration: "none",
  border: "1px solid rgba(15,23,42,0.08)",
  boxShadow: "0 5px 0 rgba(15,23,42,0.28), 0 10px 18px rgba(15,23,42,0.14)",
  transform: "translateY(-1px)",
};

const action3DPrimaryStyle: CSSProperties = {
  ...action3DBaseStyle,
  background: "#1d4ed8",
  color: "#fff",
};

const action3DDarkStyle: CSSProperties = {
  ...action3DBaseStyle,
  background: "#0f172a",
  color: "#fff",
};

const statusBoxStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
};
