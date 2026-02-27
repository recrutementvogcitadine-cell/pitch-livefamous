"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type UIEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAppLogo } from "../components/app-logo";
import LiveNotificationControls from "../components/LiveNotificationControls";

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  creator_id: string | null;
  creator_verified?: boolean | null;
  creator_is_certified?: boolean | null;
  is_certified?: boolean | null;
};

type LiveAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type LiveAiAgent = {
  id: string;
  name: string;
  gender: "male" | "female";
};

const PAGE_SIZE = 8;

export default function WatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lives, setLives] = useState<LiveRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [likedByLive, setLikedByLive] = useState<Record<string, boolean>>({});
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [aiPanelByLive, setAiPanelByLive] = useState<Record<string, boolean>>({});
  const [aiInputByLive, setAiInputByLive] = useState<Record<string, string>>({});
  const [aiLoadingByLive, setAiLoadingByLive] = useState<Record<string, boolean>>({});
  const [aiMessagesByLive, setAiMessagesByLive] = useState<Record<string, LiveAiMessage[]>>({});
  const [aiNoticeByLive, setAiNoticeByLive] = useState<Record<string, string>>({});
  const [aiNextSendAtByLive, setAiNextSendAtByLive] = useState<Record<string, number>>({});
  const [aiAgentByLive, setAiAgentByLive] = useState<Record<string, LiveAiAgent | null>>({});
  const [aiActiveAgentsByLive, setAiActiveAgentsByLive] = useState<Record<string, LiveAiAgent[]>>({});
  const [signingOut, setSigningOut] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingByCreator, setFollowingByCreator] = useState<Record<string, boolean>>({});
  const [followLoadingByCreator, setFollowLoadingByCreator] = useState<Record<string, boolean>>({});
  const [notifyByLive, setNotifyByLive] = useState<Record<string, string>>({});
  const [notifyLoadingByLive, setNotifyLoadingByLive] = useState<Record<string, boolean>>({});
  const [previewLiveId, setPreviewLiveId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const appLogo = useAppLogo();
  const followedLivesCount = useMemo(
    () =>
      lives.filter((live) => {
        if (!live.creator_id) return false;
        if (currentUserId && live.creator_id === currentUserId) return false;
        return Boolean(followingByCreator[live.creator_id]);
      }).length,
    [lives, followingByCreator, currentUserId]
  );

  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const loadLives = async (nextOffset: number, append: boolean) => {
    const authHeaders = await getAuthHeaders();
    const response = await fetch(
      `/api/lives/feed?offset=${encodeURIComponent(String(nextOffset))}&limit=${encodeURIComponent(String(PAGE_SIZE))}`,
      { cache: "no-store", headers: authHeaders }
    );

    if (response.status === 401) {
      window.location.href = "/auth";
      return;
    }

    const body = (await response.json()) as { rows?: LiveRow[]; error?: string };

    if (!response.ok) {
      throw new Error(body.error ?? "live feed fetch failed");
    }

    const rows = Array.isArray(body.rows) ? body.rows : [];
    setLives((prev) => (append ? [...prev, ...rows] : rows));
    setOffset(nextOffset + rows.length);
    setHasMore(rows.length === PAGE_SIZE);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        await loadLives(0, false);
      } catch (err: unknown) {
        setError(toDisplayErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!client) return;

    const loadAuthContext = async () => {
      const {
        data: { user },
      } = await client.auth.getUser();

      setCurrentUserId(user?.id ?? null);
    };

    void loadAuthContext();
  }, [client]);

  useEffect(() => {
    const creatorIds = Array.from(new Set(lives.map((live) => live.creator_id).filter((id): id is string => Boolean(id))));
    if (creatorIds.length === 0) return;

    const loadFollowState = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`/api/live-notify/follow?creators=${encodeURIComponent(creatorIds.join(","))}`, {
          cache: "no-store",
          headers: authHeaders,
        });

        if (!response.ok) return;

        const body = (await response.json()) as { followedCreatorIds?: string[] };
        const nextMap: Record<string, boolean> = {};
        for (const creatorId of body.followedCreatorIds ?? []) {
          nextMap[creatorId] = true;
        }
        setFollowingByCreator((prev) => ({ ...prev, ...nextMap }));
      } catch {}
    };

    void loadFollowState();
  }, [lives]);

  useEffect(() => {
    if (!previewVideoRef.current || !previewStream) return;
    previewVideoRef.current.srcObject = previewStream;
  }, [previewStream]);

  useEffect(() => {
    return () => {
      if (!previewStream) return;
      for (const track of previewStream.getTracks()) {
        track.stop();
      }
    };
  }, [previewStream]);

  const onReachEnd = async (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || loading) return;
    const target = event.currentTarget;
    const nearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 60;
    if (!nearBottom) return;

    try {
      await loadLives(offset, true);
    } catch (err: unknown) {
      setError(toDisplayErrorMessage(err));
    }
  };

  const closeCameraPreview = () => {
    if (previewStream) {
      for (const track of previewStream.getTracks()) {
        track.stop();
      }
    }
    setPreviewStream(null);
    setPreviewLiveId(null);
    setPreviewLoading(false);
    setPreviewError(null);
  };

  const openCameraPreview = async (liveId: string) => {
    if (previewLiveId === liveId && previewStream) {
      closeCameraPreview();
      return;
    }

    closeCameraPreview();
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewLiveId(liveId);

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPreviewError("Caméra non disponible sur cet appareil.");
      setPreviewLoading(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      setPreviewStream(stream);
    } catch (err: unknown) {
      setPreviewError(toDisplayErrorMessage(err));
      setPreviewLiveId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleLike = (liveId: string) => {
    setLikedByLive((prev) => ({ ...prev, [liveId]: !prev[liveId] }));
  };

  const shareLive = async (liveId: string) => {
    const url = `${window.location.origin}/lives/${liveId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Famous AI Live", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareMessage("Lien copié / partagé ✅");
      window.setTimeout(() => setShareMessage(null), 1800);
    } catch {
      setShareMessage("Partage annulé");
      window.setTimeout(() => setShareMessage(null), 1200);
    }
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (!client) return {};

    let {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.access_token) {
      await client.auth.refreshSession();
      const refreshed = await client.auth.getSession();
      session = refreshed.data.session;
    }

    if (!session?.access_token) return {};

    return { Authorization: `Bearer ${session.access_token}` };
  };

  const toggleAiPanel = async (liveId: string) => {
    const nextOpen = !aiPanelByLive[liveId];
    setAiPanelByLive((prev) => ({ ...prev, [liveId]: nextOpen }));
    if (!nextOpen) return;

    if (aiMessagesByLive[liveId]?.length) return;

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/live-ai/reply?liveId=${encodeURIComponent(liveId)}`, {
        headers: authHeaders,
      });
      const body = (await response.json()) as { messages?: LiveAiMessage[]; activeAgents?: LiveAiAgent[] };
      const remoteMessages = Array.isArray(body.messages) ? body.messages : [];

      const initialActiveAgents = Array.isArray(body.activeAgents) ? body.activeAgents : [];
      if (initialActiveAgents.length > 0) {
        setAiActiveAgentsByLive((prev) => ({ ...prev, [liveId]: initialActiveAgents }));
      }

      if (remoteMessages.length) {
        setAiMessagesByLive((prev) => ({ ...prev, [liveId]: remoteMessages }));
        return;
      }
    } catch {}

    setAiMessagesByLive((prev) => ({
      ...prev,
      [liveId]: [
        {
          id: `welcome-${liveId}`,
          role: "assistant",
          content: "Je suis un assistant virtuel IA en direct. Pose ta question.",
        },
      ],
    }));
  };

  const sendAiMessage = async (liveId: string) => {
    const text = (aiInputByLive[liveId] ?? "").trim();
    const now = Date.now();
    const nextSendAt = aiNextSendAtByLive[liveId] ?? 0;
    if (!text || aiLoadingByLive[liveId]) return;

    if (nextSendAt > now) {
      const seconds = Math.max(1, Math.ceil((nextSendAt - now) / 1000));
      setAiNoticeByLive((prev) => ({ ...prev, [liveId]: `Merci de patienter ${seconds}s avant le prochain message.` }));
      return;
    }

    setAiNoticeByLive((prev) => ({ ...prev, [liveId]: "" }));

    const userMessage: LiveAiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    const currentMessages = [...(aiMessagesByLive[liveId] ?? []), userMessage];
    setAiMessagesByLive((prev) => ({ ...prev, [liveId]: currentMessages }));
    setAiInputByLive((prev) => ({ ...prev, [liveId]: "" }));
    setAiLoadingByLive((prev) => ({ ...prev, [liveId]: true }));

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/live-ai/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          liveId,
          message: text,
          history: currentMessages.map((item) => ({ role: item.role, content: item.content })),
        }),
      });

      const body = (await response.json()) as {
        reply?: string;
        error?: string;
        retryAfterMs?: number;
        confidence?: number;
        escalated?: boolean;
        agent?: LiveAiAgent;
        activeAgents?: LiveAiAgent[];
        budget?: { ratio?: number; spentUsd?: number; limitUsd?: number; hardLimited?: boolean };
      };
      const assistantText =
        response.ok && body.reply
          ? body.reply
          : "Je suis un assistant virtuel IA en direct. Je rencontre un souci temporaire, réessaie dans quelques secondes.";

      const retryAfterMs = typeof body.retryAfterMs === "number" ? body.retryAfterMs : 0;

      if (body.agent) {
        setAiAgentByLive((prev) => ({ ...prev, [liveId]: body.agent ?? null }));
      }

      const nextActiveAgents = Array.isArray(body.activeAgents) ? body.activeAgents : [];
      if (nextActiveAgents.length > 0) {
        setAiActiveAgentsByLive((prev) => ({ ...prev, [liveId]: nextActiveAgents }));
      }

      if (retryAfterMs > 0) {
        setAiNextSendAtByLive((prev) => ({ ...prev, [liveId]: Date.now() + retryAfterMs }));
      } else {
        setAiNextSendAtByLive((prev) => ({ ...prev, [liveId]: Date.now() + 1800 }));
      }

      if (!response.ok && response.status === 429) {
        const seconds = Math.max(1, Math.ceil((retryAfterMs || 2000) / 1000));
        setAiNoticeByLive((prev) => ({ ...prev, [liveId]: `Anti-spam actif: réessaie dans ${seconds}s.` }));
      } else if (body.budget?.hardLimited) {
        setAiNoticeByLive((prev) => ({
          ...prev,
          [liveId]: "Cap budget IA atteint: réponses réduites jusqu'au prochain cycle.",
        }));
      } else if (body.escalated) {
        setAiNoticeByLive((prev) => ({
          ...prev,
          [liveId]: "Question transmise à un modérateur humain pour validation.",
        }));
      } else if (body.agent?.name) {
        const activeAgentName = body.agent.name;
        setAiNoticeByLive((prev) => ({
          ...prev,
          [liveId]: `Agent actif: ${activeAgentName}${body.budget?.ratio && body.budget.ratio >= 0.9 ? " (mode budget)" : ""}`,
        }));
      } else if (typeof body.confidence === "number" && body.confidence < 0.5) {
        setAiNoticeByLive((prev) => ({
          ...prev,
          [liveId]: "Réponse IA prudente: vérification humaine recommandée.",
        }));
      }

      setAiMessagesByLive((prev) => ({
        ...prev,
        [liveId]: [
          ...(prev[liveId] ?? []),
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: assistantText,
          },
        ],
      }));
    } catch {
      setAiMessagesByLive((prev) => ({
        ...prev,
        [liveId]: [
          ...(prev[liveId] ?? []),
          {
            id: `a-err-${Date.now()}`,
            role: "assistant",
            content:
              "Je suis un assistant virtuel IA en direct. Réseau indisponible pour l'instant, réessaie bientôt.",
          },
        ],
      }));
    } finally {
      setAiLoadingByLive((prev) => ({ ...prev, [liveId]: false }));
    }
  };

  const toggleFollow = async (creatorId: string | null) => {
    if (!creatorId || !currentUserId || creatorId === currentUserId) return;
    if (!client) return;

    const current = Boolean(followingByCreator[creatorId]);
    setFollowLoadingByCreator((prev) => ({ ...prev, [creatorId]: true }));

    try {
      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/live-notify/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ creatorId, follow: !current }),
      });

      let body: { ok?: boolean; following?: boolean; error?: string } = {};
      try {
        body = (await response.json()) as { ok?: boolean; following?: boolean; error?: string };
      } catch {}

      if (response.status === 401) {
        window.location.href = "/auth";
        return;
      }

      if (!response.ok || !body.ok) {
        throw new Error(body.error ? `${body.error} (HTTP ${response.status})` : `action impossible (HTTP ${response.status})`);
      }

      setFollowingByCreator((prev) => ({ ...prev, [creatorId]: Boolean(body.following) }));
    } catch (err: unknown) {
      setShareMessage(`Erreur follow: ${toDisplayErrorMessage(err)}`);
      window.setTimeout(() => setShareMessage(null), 2200);
    } finally {
      setFollowLoadingByCreator((prev) => ({ ...prev, [creatorId]: false }));
    }
  };

  const notifyFollowers = async (live: LiveRow) => {
    if (!live.id || !currentUserId || live.creator_id !== currentUserId) return;

    setNotifyLoadingByLive((prev) => ({ ...prev, [live.id]: true }));
    setNotifyByLive((prev) => ({ ...prev, [live.id]: "" }));

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/live-notify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ liveId: live.id, title: live.title ?? "Live en direct" }),
      });

      const body = (await response.json()) as { ok?: boolean; sent?: number; followers?: number; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "notification impossible");
      }

      setNotifyByLive((prev) => ({
        ...prev,
        [live.id]: `Notifications envoyées: ${body.sent ?? 0}/${body.followers ?? 0}`,
      }));
    } catch (err: unknown) {
      setNotifyByLive((prev) => ({ ...prev, [live.id]: `Erreur: ${toDisplayErrorMessage(err)}` }));
    } finally {
      setNotifyLoadingByLive((prev) => ({ ...prev, [live.id]: false }));
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

  if (loading) {
    return <main style={centerStyle}>Chargement du flux live…</main>;
  }

  if (error) {
    return (
      <main style={centerStyle}>
        <p>Erreur: {error}</p>
        <Link href="/auth" style={linkStyle}>
          Retour connexion
        </Link>
      </main>
    );
  }

  if (lives.length === 0) {
    return (
      <main style={centerStyle}>
        <p>Aucun live en cours pour le moment.</p>
        <Link href="/lives" style={linkStyle}>
          Voir les derniers lives
        </Link>
      </main>
    );
  }

  return (
    <main style={{ height: "100vh", overflow: "hidden", background: "#000", fontFamily: "system-ui, sans-serif" }}>
      <button type="button" onClick={() => void onSignOut()} disabled={signingOut} style={logoutButtonStyle}>
        {signingOut ? "Déconnexion..." : "Se déconnecter"}
      </button>
      <Link href="/" style={homeButtonStyle}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H14.5V14.5H9.5V21H4C3.44772 21 3 20.5523 3 20V10.5Z" fill="currentColor" />
        </svg>
        <span style={srOnlyStyle}>Accueil</span>
      </Link>

      <div
        style={{
          height: "100vh",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={onReachEnd}
      >
        {followedLivesCount > 0 ? (
          <div style={followedLivesBannerStyle}>
            🔔 {followedLivesCount} live{followedLivesCount > 1 ? "s" : ""} de créateur{followedLivesCount > 1 ? "s" : ""} suivi{followedLivesCount > 1 ? "s" : ""} en ce moment
          </div>
        ) : null}
        {lives.map((live) => (
          <section key={live.id} style={slideStyle}>
            <aside style={actionRailStyle}>
              <button onClick={() => toggleLike(live.id)} style={actionBtnStyle} aria-label="Like">
                {likedByLive[live.id] ? "❤️" : "🤍"}
                <span style={actionTextStyle}>Like</span>
              </button>
              <Link href={`/lives/${live.id}`} style={actionBtnStyle} aria-label="Comment">
                💬
                <span style={actionTextStyle}>Comment</span>
              </Link>
              <button onClick={() => shareLive(live.id)} style={actionBtnStyle} aria-label="Share">
                ↗️
                <span style={actionTextStyle}>Share</span>
              </button>
              <button onClick={() => void toggleAiPanel(live.id)} style={actionBtnStyle} aria-label="AI Assistant">
                🤖
                <span style={actionTextStyle}>AI Live</span>
              </button>
            </aside>

            <div style={overlayStyle}>
              <img
                src={appLogo}
                alt="Logo app"
                width={38}
                height={38}
                style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", background: "#fff" }}
              />
              <span style={badgeStyle}>EN DIRECT</span>
              <span style={aiBadgeStyle}>Créateur virtuel IA</span>
              {live.creator_id && currentUserId && live.creator_id !== currentUserId && followingByCreator[live.creator_id] ? (
                <span style={followedCreatorBadgeStyle}>Créateur suivi</span>
              ) : null}
              <div style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <p style={{ margin: 0, opacity: 0.95, fontWeight: 700 }}>
                  @{live.creator_id ? live.creator_id.slice(0, 8) : "createur"}
                </p>
                {isCreatorCertified(live) ? (
                  <span style={verifiedBadgeStyle} title="Créateur certifié" aria-label="Créateur certifié">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 2L14.7 4.2L18 4.4L18.8 7.6L21.4 9.6L20.4 12.8L21.4 16L18.8 18L18 21.2L14.7 21.4L12 23.6L9.3 21.4L6 21.2L5.2 18L2.6 16L3.6 12.8L2.6 9.6L5.2 7.6L6 4.4L9.3 4.2L12 2Z"
                        fill="currentColor"
                      />
                      <path d="M8 12.4L10.5 14.9L16.2 9.2" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </div>
              <h1 style={{ margin: "10px 0 6px", fontSize: 26 }}>{live.title || "Live sans titre"}</h1>
              <p style={{ margin: 0, opacity: 0.9 }}>
                {live.created_at ? new Date(live.created_at).toLocaleString("fr-FR") : "En cours"}
              </p>
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={`/lives/${live.id}`} style={actionStyle}>
                  Ouvrir ce live
                </Link>
                <Link href="/lives" style={{ ...actionStyle, background: "rgba(255,255,255,0.18)" }}>
                  Voir tous les lives
                </Link>
                {live.creator_id && live.creator_id !== currentUserId ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void openCameraPreview(live.id)}
                      style={inlineActionButtonStyle}
                    >
                      {previewLoading && previewLiveId === live.id
                        ? "Activation caméra..."
                        : previewLiveId === live.id && previewStream
                          ? "Masquer ma caméra"
                          : "Afficher ma caméra"}
                    </button>
                    <Link href="/agora-test" style={goLiveActionStyle}>
                      <span style={newBadgeStyle}>NOUVEAU</span>
                      <span style={cameraIconBadgeStyle} aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M4 8.5C4 7.12 5.12 6 6.5 6H13.5C14.88 6 16 7.12 16 8.5V15.5C16 16.88 14.88 18 13.5 18H6.5C5.12 18 4 16.88 4 15.5V8.5Z"
                            fill="#ef4444"
                          />
                          <path d="M16 10.2L20 8V16L16 13.8V10.2Z" fill="#ef4444" />
                        </svg>
                      </span>
                      <span style={goLiveLabelStyle}>Passer en live caméra</span>
                    </Link>
                    <Link href="/auth?mode=creator" style={{ ...actionStyle, background: "rgba(30,41,59,0.9)" }}>
                      Devenir créateur
                    </Link>
                  </>
                ) : null}
                {live.creator_id && live.creator_id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => void toggleFollow(live.creator_id)}
                    disabled={Boolean(followLoadingByCreator[live.creator_id])}
                    style={inlineActionButtonStyle}
                  >
                    {followLoadingByCreator[live.creator_id]
                      ? "..."
                      : followingByCreator[live.creator_id]
                        ? "Ne plus suivre"
                        : "Suivre"}
                  </button>
                ) : null}
                {live.creator_id && live.creator_id === currentUserId ? (
                  <button
                    type="button"
                    onClick={() => void notifyFollowers(live)}
                    disabled={Boolean(notifyLoadingByLive[live.id])}
                    style={inlineActionButtonStyle}
                  >
                    {notifyLoadingByLive[live.id] ? "Envoi..." : "Notifier mes followers"}
                  </button>
                ) : null}
              </div>
              {live.creator_id && live.creator_id === currentUserId && notifyByLive[live.id] ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.92 }}>{notifyByLive[live.id]}</p>
              ) : null}
              <div style={{ marginTop: 10 }}>
                <LiveNotificationControls />
              </div>
            </div>

            {aiPanelByLive[live.id] ? (
              <section style={aiPanelStyle}>
                <div style={aiPanelHeaderStyle}>Q&A Live IA</div>
                {aiAgentByLive[live.id]?.name ? (
                  <div style={aiAgentStyle}>
                    Agent actif: {aiAgentByLive[live.id]?.name} · {aiAgentByLive[live.id]?.gender === "female" ? "Femme" : "Homme"}
                  </div>
                ) : null}
                {aiActiveAgentsByLive[live.id]?.length ? (
                  <div style={aiRosterStyle}>Roster live: {aiActiveAgentsByLive[live.id].map((agent) => agent.name).join(" · ")}</div>
                ) : null}
                <div style={aiMessagesWrapStyle}>
                  {(aiMessagesByLive[live.id] ?? []).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        ...aiMessageStyle,
                        alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                        background: item.role === "user" ? "#1d4ed8" : "rgba(30,41,59,0.9)",
                      }}
                    >
                      {item.content}
                    </div>
                  ))}
                </div>
                {aiNoticeByLive[live.id] ? <div style={aiNoticeStyle}>{aiNoticeByLive[live.id]}</div> : null}
                <div style={aiInputRowStyle}>
                  <input
                    value={aiInputByLive[live.id] ?? ""}
                    onChange={(event) =>
                      setAiInputByLive((prev) => ({ ...prev, [live.id]: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendAiMessage(live.id);
                      }
                    }}
                    placeholder="Pose ta question en direct"
                    style={aiInputStyle}
                    maxLength={500}
                  />
                  <button
                    onClick={() => void sendAiMessage(live.id)}
                    style={aiSendStyle}
                    disabled={Boolean(aiLoadingByLive[live.id])}
                  >
                    {aiLoadingByLive[live.id] ? "..." : "Envoyer"}
                  </button>
                </div>
              </section>
            ) : null}

            {shareMessage ? <div style={shareToastStyle}>{shareMessage}</div> : null}
          </section>
        ))}

        {!hasMore ? (
          <section style={{ ...slideStyle, alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "#fff", opacity: 0.8 }}>Fin du flux pour le moment</div>
          </section>
        ) : null}
      </div>

      {previewLiveId ? (
        <section style={cameraPreviewPanelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>Prévisualisation caméra spectateur</strong>
            <button type="button" onClick={closeCameraPreview} style={cameraCloseButtonStyle}>
              ✕
            </button>
          </div>
          <video ref={previewVideoRef} autoPlay playsInline muted style={cameraVideoStyle} />
          {previewError ? <p style={{ margin: 0, color: "#fecaca", fontSize: 12 }}>Erreur caméra: {previewError}</p> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/agora-test" style={goLiveActionStyle}>
              <span style={newBadgeStyle}>NOUVEAU</span>
              <span style={cameraIconBadgeStyle} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 8.5C4 7.12 5.12 6 6.5 6H13.5C14.88 6 16 7.12 16 8.5V15.5C16 16.88 14.88 18 13.5 18H6.5C5.12 18 4 16.88 4 15.5V8.5Z"
                    fill="#ef4444"
                  />
                  <path d="M16 10.2L20 8V16L16 13.8V10.2Z" fill="#ef4444" />
                </svg>
              </span>
              <span style={goLiveLabelStyle}>Passer en live (créateur)</span>
            </Link>
            <Link href="/auth?mode=creator" style={{ ...actionStyle, background: "rgba(30,41,59,0.95)" }}>
              Demander statut créateur
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

const centerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#020617",
  color: "#fff",
  textAlign: "center",
};

const slideStyle: CSSProperties = {
  height: "100vh",
  scrollSnapAlign: "start",
  scrollSnapStop: "always",
  position: "relative",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-start",
  padding: 20,
  background:
    "radial-gradient(circle at 20% 20%, #1d4ed8 0%, #0f172a 40%, #020617 100%)",
  color: "#fff",
};

const overlayStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 14,
  padding: 14,
  background: "rgba(15, 23, 42, 0.55)",
  backdropFilter: "blur(4px)",
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const aiBadgeStyle: CSSProperties = {
  display: "inline-block",
  borderRadius: 999,
  background: "#2563eb",
  color: "#fff",
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
  marginLeft: 8,
};

const verifiedBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  color: "#3b82f6",
  background: "#2563eb",
  border: "1px solid rgba(255,255,255,0.25)",
  boxShadow: "0 4px 10px rgba(37,99,235,0.45)",
};

const actionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#fff",
  textDecoration: "none",
  background: "#2563eb",
  fontWeight: 700,
};

const goLiveActionStyle: CSSProperties = {
  ...actionStyle,
  background: "#f97316",
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "0 8px 18px rgba(249,115,22,0.4)",
  gap: 8,
};

const cameraIconBadgeStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.92)",
  boxShadow: "0 3px 8px rgba(127,29,29,0.25)",
};

const goLiveLabelStyle: CSSProperties = {
  lineHeight: 1,
  fontWeight: 800,
};

const newBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "3px 7px",
  background: "#ef4444",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.3,
  boxShadow: "0 3px 8px rgba(127,29,29,0.35)",
};

const inlineActionButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.35)",
  borderRadius: 999,
  padding: "9px 12px",
  background: "rgba(255,255,255,0.16)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const linkStyle: CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 700,
};

const homeButtonStyle: CSSProperties = {
  position: "fixed",
  left: 14,
  bottom: 18,
  zIndex: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  width: 46,
  height: 46,
  color: "#fff",
  background: "rgba(15, 23, 42, 0.78)",
  border: "1px solid rgba(255,255,255,0.22)",
  textDecoration: "none",
  boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
  backdropFilter: "blur(5px)",
};

const actionRailStyle: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 120,
  zIndex: 9,
  display: "grid",
  gap: 10,
};

const actionBtnStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#fff",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  textDecoration: "none",
  fontSize: 18,
  cursor: "pointer",
};

const actionTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
};

const shareToastStyle: CSSProperties = {
  position: "absolute",
  bottom: 80,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(15,23,42,0.8)",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
};

const followedLivesBannerStyle: CSSProperties = {
  position: "sticky",
  top: 56,
  zIndex: 14,
  margin: "10px auto 0",
  width: "fit-content",
  maxWidth: "calc(100vw - 24px)",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(30,41,59,0.9)",
  border: "1px solid rgba(56,189,248,0.45)",
  color: "#e0f2fe",
  fontSize: 13,
  fontWeight: 700,
  backdropFilter: "blur(4px)",
};

const followedCreatorBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 999,
  padding: "5px 10px",
  background: "rgba(56,189,248,0.22)",
  border: "1px solid rgba(56,189,248,0.5)",
  color: "#e0f2fe",
  fontSize: 11,
  fontWeight: 700,
};

const aiPanelStyle: CSSProperties = {
  position: "absolute",
  right: 88,
  bottom: 24,
  width: 320,
  maxWidth: "calc(100vw - 130px)",
  maxHeight: "58vh",
  borderRadius: 12,
  background: "rgba(2,6,23,0.88)",
  border: "1px solid rgba(148,163,184,0.35)",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  overflow: "hidden",
  backdropFilter: "blur(4px)",
};

const aiPanelHeaderStyle: CSSProperties = {
  padding: "10px 12px",
  color: "#fff",
  fontWeight: 700,
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  fontSize: 13,
};

const aiMessagesWrapStyle: CSSProperties = {
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "auto",
};

const aiMessageStyle: CSSProperties = {
  maxWidth: "90%",
  color: "#fff",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  lineHeight: 1.35,
};

const aiInputRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  padding: 10,
  borderTop: "1px solid rgba(148,163,184,0.25)",
};

const aiNoticeStyle: CSSProperties = {
  padding: "0 10px 8px",
  color: "#fcd34d",
  fontSize: 12,
  fontWeight: 600,
};

const aiAgentStyle: CSSProperties = {
  padding: "8px 10px 0",
  color: "#93c5fd",
  fontSize: 12,
  fontWeight: 700,
};

const aiRosterStyle: CSSProperties = {
  padding: "2px 10px 6px",
  color: "#cbd5e1",
  fontSize: 11,
  opacity: 0.95,
};

const aiInputStyle: CSSProperties = {
  border: "1px solid rgba(148,163,184,0.4)",
  borderRadius: 10,
  padding: "8px 10px",
  background: "rgba(15,23,42,0.85)",
  color: "#fff",
  fontSize: 13,
};

const aiSendStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 11px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const srOnlyStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const logoutButtonStyle: CSSProperties = {
  position: "fixed",
  right: 14,
  top: 14,
  zIndex: 25,
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 999,
  padding: "8px 12px",
  background: "rgba(15, 23, 42, 0.78)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  backdropFilter: "blur(5px)",
};

const cameraPreviewPanelStyle: CSSProperties = {
  position: "fixed",
  left: 14,
  right: 14,
  bottom: 14,
  zIndex: 30,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(2,6,23,0.92)",
  color: "#fff",
  padding: 10,
  display: "grid",
  gap: 8,
  maxWidth: 560,
  margin: "0 auto",
};

const cameraVideoStyle: CSSProperties = {
  width: "100%",
  maxHeight: 220,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.35)",
  background: "#0f172a",
  objectFit: "cover",
};

const cameraCloseButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 8,
  background: "rgba(30,41,59,0.9)",
  color: "#fff",
  width: 28,
  height: 28,
  cursor: "pointer",
};

function isCreatorCertified(live: LiveRow) {
  return Boolean(live.creator_verified || live.creator_is_certified || live.is_certified);
}

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

  return "Une erreur est survenue pendant le chargement du live.";
}
