"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type AppRole = "super_admin" | "admin" | "agent";

type RoleUser = {
  id: string;
  email?: string;
  role: AppRole;
};

type RoleResponse = {
  currentUser?: { id: string; email?: string; role: AppRole };
  users?: RoleUser[];
  error?: string;
};

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
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>({});
  const [currentRole, setCurrentRole] = useState<AppRole>("agent");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAssignSuperAdmin = currentRole === "super_admin";

  const roleOptions = useMemo(
    () =>
      (canAssignSuperAdmin
        ? (["super_admin", "admin", "agent"] as AppRole[])
        : (["admin", "agent"] as AppRole[])),
    [canAssignSuperAdmin]
  );

  const loadRoles = async () => {
    setLoadingRoles(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/roles", { cache: "no-store" });
      const body = (await response.json()) as RoleResponse;

      if (!response.ok) {
        throw new Error(body.error ?? "Impossible de charger les rôles.");
      }

      const users = Array.isArray(body.users) ? body.users : [];
      const nextDrafts: Record<string, AppRole> = {};
      for (const item of users) {
        nextDrafts[item.id] = item.role;
      }

      setRoleUsers(users);
      setDraftRoles(nextDrafts);
      setCurrentRole(body.currentUser?.role ?? "agent");
    } catch (err: unknown) {
      setRoleUsers([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const updateRole = async (userId: string) => {
    const role = draftRoles[userId];
    if (!role) return;

    setSavingUserId(userId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Mise à jour impossible.");
      }

      setRoleUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, role } : item)));
      setMessage("Rôle mis à jour ✅");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUserId(null);
    }
  };

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

        <section style={roleCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Gestion des rôles</h2>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>
                Définissez les rôles <strong>super_admin</strong>, <strong>admin</strong> et <strong>agent</strong>.
              </p>
            </div>
            <button type="button" onClick={() => void loadRoles()} style={action3DDarkStyle}>
              Rafraîchir
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700 }}>
            Votre rôle actuel: {currentRole}
          </div>

          {loadingRoles ? <p style={{ margin: 0 }}>Chargement des utilisateurs...</p> : null}
          {message ? <p style={{ color: "#15803d", margin: 0 }}>{message}</p> : null}
          {error ? <p style={{ color: "#b91c1c", margin: 0 }}>Erreur: {error}</p> : null}

          {!loadingRoles ? (
            <div style={{ display: "grid", gap: 8 }}>
              {roleUsers.map((item) => (
                <article key={item.id} style={roleRowStyle}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <strong>{item.email ?? item.id}</strong>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Rôle actuel: {item.role}</span>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={draftRoles[item.id] ?? item.role}
                      onChange={(event) =>
                        setDraftRoles((prev) => ({ ...prev, [item.id]: event.target.value as AppRole }))
                      }
                      style={selectStyle}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void updateRole(item.id)}
                      disabled={savingUserId === item.id}
                      style={action3DPrimaryStyle}
                    >
                      {savingUserId === item.id ? "..." : "Appliquer"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
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

const roleCardStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  gap: 10,
};

const roleRowStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 10,
  background: "#fff",
  padding: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const selectStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: 600,
};
