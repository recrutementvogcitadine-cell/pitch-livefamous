"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAppLogo } from "../../components/app-logo";

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

type LiveNotifyStats = {
  followersLinks: number;
  creatorsFollowed: number;
  uniqueFollowers: number;
  pushSubscriptions: number;
  notificationsSentTotal: number;
  notificationsEvents: number;
  lastSentAt?: string | null;
  eventsTableMissing?: boolean;
};

type BrandingSettings = {
  appName: string;
  welcomeMessage: string;
  logoSrc: string;
  error?: string;
};

type ButtonLabelSettings = {
  goLiveLabel: string;
  goLiveCreatorLabel: string;
  becomeCreatorLabel: string;
  allowAgentEdit: boolean;
  currentRole?: AppRole;
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
  const appLogo = useAppLogo();
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>({});
  const [currentRole, setCurrentRole] = useState<AppRole>("agent");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [notifyStats, setNotifyStats] = useState<LiveNotifyStats | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [branding, setBranding] = useState<BrandingSettings>({
    appName: "Pitch Live",
    welcomeMessage: "Bienvenue sur Pitch Live — découvrez les lives en cours et connectez-vous en temps réel.",
    logoSrc: "/famous-ai-logo.svg",
  });
  const [loadingButtonLabels, setLoadingButtonLabels] = useState(true);
  const [savingButtonLabels, setSavingButtonLabels] = useState(false);
  const [buttonLabels, setButtonLabels] = useState<ButtonLabelSettings>({
    goLiveLabel: "Passer en live caméra",
    goLiveCreatorLabel: "Passer en live (créateur)",
    becomeCreatorLabel: "Devenir créateur",
    allowAgentEdit: false,
  });

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

  const loadNotifyStats = async () => {
    setLoadingStats(true);
    try {
      const response = await fetch("/api/admin/live-notify/stats", { cache: "no-store" });
      const body = (await response.json()) as LiveNotifyStats & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Impossible de charger les stats notifications.");
      }
      setNotifyStats(body);
    } catch {
      setNotifyStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    void loadNotifyStats();
  }, []);

  const loadBranding = async () => {
    setLoadingBranding(true);
    try {
      const response = await fetch("/api/admin/branding", { cache: "no-store" });
      const body = (await response.json()) as BrandingSettings;
      if (!response.ok) {
        throw new Error(body.error ?? "Impossible de charger le branding.");
      }

      setBranding((prev) => ({
        ...prev,
        appName: body.appName ?? prev.appName,
        welcomeMessage: body.welcomeMessage ?? prev.welcomeMessage,
        logoSrc: body.logoSrc ?? prev.logoSrc,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBranding(false);
    }
  };

  useEffect(() => {
    void loadBranding();
  }, []);

  const saveBranding = async () => {
    setSavingBranding(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName: branding.appName,
          welcomeMessage: branding.welcomeMessage,
          logoSrc: branding.logoSrc,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Enregistrement branding impossible.");
      }
      setMessage("Branding public mis à jour ✅");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBranding(false);
    }
  };

  const loadButtonLabels = async () => {
    setLoadingButtonLabels(true);
    try {
      const response = await fetch("/api/admin/button-labels", { cache: "no-store" });
      const body = (await response.json()) as ButtonLabelSettings;
      if (!response.ok) {
        throw new Error(body.error ?? "Impossible de charger les labels des boutons.");
      }
      setButtonLabels((prev) => ({
        ...prev,
        goLiveLabel: body.goLiveLabel ?? prev.goLiveLabel,
        goLiveCreatorLabel: body.goLiveCreatorLabel ?? prev.goLiveCreatorLabel,
        becomeCreatorLabel: body.becomeCreatorLabel ?? prev.becomeCreatorLabel,
        allowAgentEdit: Boolean(body.allowAgentEdit),
      }));
      if (body.currentRole) {
        setCurrentRole(body.currentRole);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingButtonLabels(false);
    }
  };

  useEffect(() => {
    void loadButtonLabels();
  }, []);

  const saveButtonLabels = async () => {
    setSavingButtonLabels(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/button-labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goLiveLabel: buttonLabels.goLiveLabel,
          goLiveCreatorLabel: buttonLabels.goLiveCreatorLabel,
          becomeCreatorLabel: buttonLabels.becomeCreatorLabel,
          allowAgentEdit: buttonLabels.allowAgentEdit,
        }),
      });

      const body = (await response.json()) as ButtonLabelSettings;
      if (!response.ok) {
        throw new Error(body.error ?? "Enregistrement impossible.");
      }

      setButtonLabels((prev) => ({
        ...prev,
        goLiveLabel: body.goLiveLabel ?? prev.goLiveLabel,
        goLiveCreatorLabel: body.goLiveCreatorLabel ?? prev.goLiveCreatorLabel,
        becomeCreatorLabel: body.becomeCreatorLabel ?? prev.becomeCreatorLabel,
        allowAgentEdit: Boolean(body.allowAgentEdit),
      }));
      setMessage("Libellés des boutons mis à jour ✅");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingButtonLabels(false);
    }
  };

  const canEditButtonLabels =
    currentRole === "super_admin" || currentRole === "admin" || (currentRole === "agent" && buttonLabels.allowAgentEdit);

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={appLogo} alt="Logo app" width={38} height={38} style={{ borderRadius: 10, border: "1px solid #bfdbfe", background: "#fff" }} />
          <span style={{ color: "#1e3a8a", fontWeight: 700, fontSize: 13 }}>Dashboard Propriétaire</span>
        </div>
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
              <h2 style={{ margin: 0 }}>Followers & Notifications</h2>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>
                Indicateurs live followers, abonnements push et notifications envoyées.
              </p>
            </div>
            <button type="button" onClick={() => void loadNotifyStats()} style={action3DDarkStyle}>
              Rafraîchir
            </button>
          </div>

          {loadingStats ? <p style={{ margin: 0 }}>Chargement des stats...</p> : null}

          {!loadingStats && notifyStats ? (
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Liens followers</small>
                <strong style={metricValueStyle}>{notifyStats.followersLinks}</strong>
              </article>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Créateurs suivis</small>
                <strong style={metricValueStyle}>{notifyStats.creatorsFollowed}</strong>
              </article>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Followers uniques</small>
                <strong style={metricValueStyle}>{notifyStats.uniqueFollowers}</strong>
              </article>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Abonnements push</small>
                <strong style={metricValueStyle}>{notifyStats.pushSubscriptions}</strong>
              </article>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Notifications envoyées</small>
                <strong style={metricValueStyle}>{notifyStats.notificationsSentTotal}</strong>
              </article>
              <article style={metricCardStyle}>
                <small style={metricLabelStyle}>Campagnes</small>
                <strong style={metricValueStyle}>{notifyStats.notificationsEvents}</strong>
              </article>
            </div>
          ) : null}

          {!loadingStats && notifyStats?.lastSentAt ? (
            <p style={{ margin: 0, color: "#334155", fontSize: 13 }}>
              Dernier envoi: {new Date(notifyStats.lastSentAt).toLocaleString("fr-FR")}
            </p>
          ) : null}

          {!loadingStats && notifyStats?.eventsTableMissing ? (
            <p style={{ margin: 0, color: "#92400e", fontSize: 13 }}>
              Historique d&apos;envoi indisponible: exécuter le SQL `live_notification_events` en prod.
            </p>
          ) : null}
        </section>

        <section style={roleCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Branding public</h2>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>
                Modifier le nom app, le message d&apos;accueil et le logo visibles sur l&apos;accueil et le bouton installer.
              </p>
            </div>
            <button type="button" onClick={() => void loadBranding()} style={action3DDarkStyle}>
              Rafraîchir
            </button>
          </div>

          {loadingBranding ? <p style={{ margin: 0 }}>Chargement branding...</p> : null}

          {!loadingBranding ? (
            <div style={{ display: "grid", gap: 8 }}>
              <label style={fieldLabelStyle}>
                Nom application
                <input
                  value={branding.appName}
                  onChange={(event) => setBranding((prev) => ({ ...prev, appName: event.target.value }))}
                  style={inputStyle}
                  maxLength={80}
                  disabled={savingBranding}
                />
              </label>

              <label style={fieldLabelStyle}>
                Message d&apos;accueil nouveaux venus
                <textarea
                  value={branding.welcomeMessage}
                  onChange={(event) => setBranding((prev) => ({ ...prev, welcomeMessage: event.target.value }))}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  maxLength={220}
                  disabled={savingBranding}
                />
              </label>

              <label style={fieldLabelStyle}>
                Logo (URL ou data:image/...)
                <input
                  value={branding.logoSrc}
                  onChange={(event) => setBranding((prev) => ({ ...prev, logoSrc: event.target.value }))}
                  style={inputStyle}
                  maxLength={2000}
                  disabled={savingBranding}
                />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <img src={branding.logoSrc} alt="Aperçu logo" width={34} height={34} style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" }} />
                <strong style={{ color: "#0f172a" }}>{branding.appName}</strong>
              </div>

              <div>
                <button type="button" onClick={() => void saveBranding()} style={action3DPrimaryStyle} disabled={savingBranding}>
                  {savingBranding ? "Enregistrement..." : "Enregistrer branding"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section style={roleCardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Personnalisation des boutons Live</h2>
              <p style={{ margin: "6px 0 0", color: "#475569" }}>
                Modifier les noms des boutons affichés aux spectateurs sur /watch.
              </p>
            </div>
            <button type="button" onClick={() => void loadButtonLabels()} style={action3DDarkStyle}>
              Rafraîchir
            </button>
          </div>

          {loadingButtonLabels ? <p style={{ margin: 0 }}>Chargement des libellés...</p> : null}

          {!loadingButtonLabels ? (
            <div style={{ display: "grid", gap: 8 }}>
              <label style={fieldLabelStyle}>
                Bouton principal Live caméra
                <input
                  value={buttonLabels.goLiveLabel}
                  onChange={(event) =>
                    setButtonLabels((prev) => ({ ...prev, goLiveLabel: event.target.value }))
                  }
                  style={inputStyle}
                  maxLength={80}
                  disabled={!canEditButtonLabels || savingButtonLabels}
                />
              </label>

              <label style={fieldLabelStyle}>
                Bouton Live créateur (panneau caméra)
                <input
                  value={buttonLabels.goLiveCreatorLabel}
                  onChange={(event) =>
                    setButtonLabels((prev) => ({ ...prev, goLiveCreatorLabel: event.target.value }))
                  }
                  style={inputStyle}
                  maxLength={80}
                  disabled={!canEditButtonLabels || savingButtonLabels}
                />
              </label>

              <label style={fieldLabelStyle}>
                Bouton devenir créateur
                <input
                  value={buttonLabels.becomeCreatorLabel}
                  onChange={(event) =>
                    setButtonLabels((prev) => ({ ...prev, becomeCreatorLabel: event.target.value }))
                  }
                  style={inputStyle}
                  maxLength={80}
                  disabled={!canEditButtonLabels || savingButtonLabels}
                />
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#334155", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={buttonLabels.allowAgentEdit}
                  onChange={(event) =>
                    setButtonLabels((prev) => ({ ...prev, allowAgentEdit: event.target.checked }))
                  }
                  disabled={currentRole !== "super_admin" || savingButtonLabels}
                />
                Autoriser les agents à modifier les libellés
              </label>

              {currentRole !== "super_admin" ? (
                <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
                  Seul le propriétaire (super_admin) peut activer/désactiver l&apos;édition par les agents.
                </p>
              ) : null}

              {!canEditButtonLabels ? (
                <p style={{ margin: 0, color: "#92400e", fontSize: 13 }}>
                  Édition bloquée pour ce rôle. Le propriétaire peut autoriser les agents depuis cette section.
                </p>
              ) : null}

              <div>
                <button
                  type="button"
                  onClick={() => void saveButtonLabels()}
                  style={action3DPrimaryStyle}
                  disabled={!canEditButtonLabels || savingButtonLabels}
                >
                  {savingButtonLabels ? "Enregistrement..." : "Enregistrer les libellés"}
                </button>
              </div>
            </div>
          ) : null}
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

const metricCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 10,
  background: "#fff",
  padding: 10,
  display: "grid",
  gap: 4,
};

const metricLabelStyle: CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
  fontSize: 12,
};

const metricValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 22,
  lineHeight: 1,
};

const fieldLabelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 700,
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 14,
  color: "#0f172a",
  background: "#fff",
};
