"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type UIEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAppLogo } from "../components/app-logo";
import LiveNotificationControls from "../components/LiveNotificationControls";

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  lifecycleState?: "LIVE_ACTIVE" | "LIVE_SCHEDULED" | "LIVE_ENDED";
  created_at: string | null;
  creator_id: string | null;
  creator_whatsapp?: string | null;
  creator_verified?: boolean | null;
  creator_is_certified?: boolean | null;
  is_certified?: boolean | null;
};

type DiscoveryFallbackItem = {
  isLive?: boolean;
  liveId?: string | null;
  liveTitle?: string | null;
  liveStartedAt?: string | null;
  creatorId?: string;
  creatorCertifiedBlue?: boolean;
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

type WatchButtonLabels = {
  goLiveLabel: string;
  goLiveCreatorLabel: string;
  becomeCreatorLabel: string;
};

type CreatorAccessState = {
  isAuthenticated: boolean;
  isValidatedCreator: boolean;
  accountType: string;
  creatorRequestStatus: string;
  creatorRole: string;
  shouldRedirectToCreatorForm: boolean;
  launchHref: string;
  creatorFormHref: string;
};

type PlatformStatsResponse = {
  source?: "connected" | "degraded" | "disconnected";
};

const PAGE_SIZE = 8;
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export default function WatchPage() {
  const startLiveId =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("startLiveId")?.trim() || null : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lives, setLives] = useState<LiveRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
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
  const [buttonLabels, setButtonLabels] = useState<WatchButtonLabels>({
    goLiveLabel: "Passer en live caméra",
    goLiveCreatorLabel: "Passer en live (créateur)",
    becomeCreatorLabel: "Devenir créateur",
  });
  const [creatorAccess, setCreatorAccess] = useState<CreatorAccessState>({
    isAuthenticated: false,
    isValidatedCreator: false,
    accountType: "spectator",
    creatorRequestStatus: "none",
    creatorRole: "none",
    shouldRedirectToCreatorForm: true,
    launchHref: "/settings",
    creatorFormHref: "/auth?mode=creator",
  });
  const [platformSource, setPlatformSource] = useState<"connected" | "degraded" | "disconnected">("disconnected");
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

  const loadLives = useCallback(async (nextOffset: number, append: boolean) => {
    const response = await fetch(
      `/api/lives/feed?offset=${encodeURIComponent(String(nextOffset))}&limit=${encodeURIComponent(String(PAGE_SIZE))}&liveOnly=true&v=${encodeURIComponent(BUILD_ID)}`,
      { cache: "no-store" }
    );

    let rows: LiveRow[] = [];
    if (response.ok) {
      const body = (await response.json()) as { rows?: LiveRow[] };
      rows = Array.isArray(body.rows) ? body.rows : [];
    }

    if (rows.length === 0 && nextOffset === 0) {
      try {
        const fallbackResponse = await fetch(
          `/api/lives/discovery?limit=${encodeURIComponent(String(PAGE_SIZE))}&v=${encodeURIComponent(BUILD_ID)}`,
          {
            cache: "no-store",
          }
        );
        if (fallbackResponse.ok) {
          const fallbackBody = (await fallbackResponse.json()) as { feed?: DiscoveryFallbackItem[] };
          const fallbackFeed = Array.isArray(fallbackBody.feed) ? fallbackBody.feed : [];
          rows = fallbackFeed
            .filter((item): item is DiscoveryFallbackItem & { liveId: string } => Boolean(item.isLive && item.liveId))
            .map((item) => ({
              id: item.liveId,
              title: item.liveTitle ?? "Live en direct",
              status: "live",
              created_at: item.liveStartedAt ?? null,
              creator_id: item.creatorId ?? null,
              creator_verified: item.creatorCertifiedBlue ?? false,
              creator_is_certified: item.creatorCertifiedBlue ?? false,
              is_certified: item.creatorCertifiedBlue ?? false,
              lifecycleState: "LIVE_ACTIVE",
            }));
        }
      } catch {}
    }

    if (!response.ok && rows.length === 0) {
      throw new Error("live feed fetch failed");
    }

    const orderedRows =
      !append && startLiveId
        ? (() => {
            const picked = rows.find((item) => item.id === startLiveId);
            if (!picked) return rows;
            return [picked, ...rows.filter((item) => item.id !== startLiveId)];
          })()
        : rows;

    setLives((prev) => (append ? [...prev, ...orderedRows] : orderedRows));
    setOffset(nextOffset + rows.length);
    setHasMore(rows.length === PAGE_SIZE);
  }, [startLiveId]);

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
  }, [loadLives]);

  useEffect(() => {
    if (!client) return;

    const channel = client
      .channel("watch-lives-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_streams" },
        () => {
          void loadLives(0, false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lives" },
        () => {
          void loadLives(0, false);
        }
      );

    channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [client, loadLives]);

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
    const loadButtonLabels = async () => {
      try {
        const response = await fetch("/api/ui/button-labels", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as Partial<WatchButtonLabels>;
        setButtonLabels((prev) => ({
          goLiveLabel: typeof body.goLiveLabel === "string" && body.goLiveLabel.trim() ? body.goLiveLabel : prev.goLiveLabel,
          goLiveCreatorLabel:
            typeof body.goLiveCreatorLabel === "string" && body.goLiveCreatorLabel.trim()
              ? body.goLiveCreatorLabel
              : prev.goLiveCreatorLabel,
          becomeCreatorLabel:
            typeof body.becomeCreatorLabel === "string" && body.becomeCreatorLabel.trim()
              ? body.becomeCreatorLabel
              : prev.becomeCreatorLabel,
        }));
      } catch {}
    };

    void loadButtonLabels();
  }, []);

  useEffect(() => {
    const loadCreatorAccess = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch("/api/creator/access", { cache: "no-store", headers: authHeaders });
        if (!response.ok) return;
        const body = (await response.json()) as Partial<CreatorAccessState>;
        setCreatorAccess((prev) => ({
          ...prev,
          isAuthenticated: Boolean(body.isAuthenticated),
          isValidatedCreator: Boolean(body.isValidatedCreator),
          accountType: typeof body.accountType === "string" ? body.accountType : prev.accountType,
          creatorRequestStatus:
            typeof body.creatorRequestStatus === "string" ? body.creatorRequestStatus : prev.creatorRequestStatus,
          creatorRole: typeof body.creatorRole === "string" ? body.creatorRole : prev.creatorRole,
          shouldRedirectToCreatorForm: Boolean(body.shouldRedirectToCreatorForm),
          launchHref: typeof body.launchHref === "string" && body.launchHref.trim() ? body.launchHref : prev.launchHref,
          creatorFormHref:
            typeof body.creatorFormHref === "string" && body.creatorFormHref.trim()
              ? body.creatorFormHref
              : prev.creatorFormHref,
        }));
      } catch {}
    };

    void loadCreatorAccess();
  }, []);

  const loadPlatformStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/lives/platform-stats", { cache: "no-store" });
      if (!response.ok) {
        setPlatformSource("disconnected");
        return;
      }

      const body = (await response.json()) as PlatformStatsResponse;
      const source = body.source;
      if (source === "connected" || source === "degraded" || source === "disconnected") {
        setPlatformSource(source);
      } else {
        setPlatformSource("disconnected");
      }
    } catch {
      setPlatformSource("disconnected");
    }
  }, []);

  useEffect(() => {
    void loadPlatformStatus();
    const interval = setInterval(() => {
      void loadPlatformStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadPlatformStatus]);

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

  const openLiveByTap = (event: MouseEvent<HTMLElement>, live: LiveRow) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("a,button,input,select,textarea,label,video")) {
      return;
    }

    const nextUrl = `/live/${encodeURIComponent(live.id)}`;
    window.location.replace(nextUrl);
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
      setError(`Erreur follow: ${toDisplayErrorMessage(err)}`);
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

  const cameraActionHref = creatorAccess.isValidatedCreator ? creatorAccess.launchHref : creatorAccess.creatorFormHref;
  const cameraActionLabel = creatorAccess.isValidatedCreator ? buttonLabels.goLiveLabel : buttonLabels.becomeCreatorLabel;
  const cameraCreatorLabel = creatorAccess.isValidatedCreator ? buttonLabels.goLiveCreatorLabel : buttonLabels.becomeCreatorLabel;
  const humanLives = useMemo(() => lives.filter((live) => !isAiLive(live)), [lives]);
  const aiLives = useMemo(() => lives.filter((live) => isAiLive(live)), [lives]);
  const separatedLives = useMemo(() => [...humanLives, ...aiLives], [humanLives, aiLives]);
  const platformStatusLabel =
    platformSource === "connected"
      ? "🟢 Connecté à la base"
      : platformSource === "degraded"
        ? "🟡 Mode dégradé"
        : "🔵 Mode démo";
  const platformStatusTheme =
    platformSource === "connected"
      ? {
          borderColor: "rgba(34,197,94,0.45)",
          background: "rgba(22,101,52,0.45)",
          color: "#dcfce7",
        }
      : platformSource === "degraded"
        ? {
            borderColor: "rgba(234,179,8,0.45)",
            background: "rgba(133,77,14,0.45)",
            color: "#fef9c3",
          }
        : {
            borderColor: "rgba(59,130,246,0.45)",
            background: "rgba(30,64,175,0.45)",
            color: "#dbeafe",
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
      <div style={{ ...footerConnectionStyle, ...platformStatusTheme }} aria-live="polite">
        {platformStatusLabel}
      </div>

      <div
        style={{
          height: "100vh",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={onReachEnd}
      >
        <div style={{ ...connectionBannerStyle, ...platformStatusTheme }}>{platformStatusLabel} • statut plateforme</div>
        {followedLivesCount > 0 ? (
          <div style={followedLivesBannerStyle}>
            🔔 {followedLivesCount} live{followedLivesCount > 1 ? "s" : ""} de créateur{followedLivesCount > 1 ? "s" : ""} suivi{followedLivesCount > 1 ? "s" : ""} en ce moment
          </div>
        ) : null}
        {separatedLives.map((live, index) => (
          <Fragment key={live.id}>
          {index === 0 && humanLives.length > 0 ? (
            <section style={feedLabelSlideStyle}>
              <div style={feedLabelStyle}>Lives humains</div>
            </section>
          ) : null}
          {index === humanLives.length && aiLives.length > 0 ? (
            <section style={feedLabelSlideStyle}>
              <div style={feedLabelStyle}>Lives IA</div>
            </section>
          ) : null}
          <section
            key={live.id}
            style={{ ...slideStyle, cursor: live.creator_id !== currentUserId ? "pointer" : "default" }}
            onClick={(event) => openLiveByTap(event, live)}
          >
            <aside style={actionRailStyle}>
              <button onClick={() => void toggleAiPanel(live.id)} style={actionBtnStyle} aria-label="AI Assistant">
                🤖
                <span style={actionTextStyle}>AI Live</span>
              </button>
              {live.creator_id && live.creator_id !== currentUserId ? (
                <Link href={cameraActionHref} style={cameraRailLinkStyle} aria-label={cameraActionLabel}>
                  <span style={cameraFeedIconStyle} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="6" width="13" height="12" rx="2.8" fill="white" />
                      <path d="M16.5 10L21 8V16L16.5 14V10Z" fill="white" />
                      <circle cx="10" cy="12" r="3.4" fill="#dc2626" />
                      <circle cx="10" cy="12" r="1.4" fill="white" />
                    </svg>
                  </span>
                  <span style={actionTextStyle}>{creatorAccess.isValidatedCreator ? "Live" : "Caméra"}</span>
                </Link>
              ) : null}
            </aside>

            <div style={overlayStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <img
                  src={appLogo}
                  alt="Logo app"
                  width={38}
                  height={38}
                  style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", background: "#fff" }}
                />
                {live.creator_id && live.creator_id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => void toggleFollow(live.creator_id)}
                    disabled={Boolean(followLoadingByCreator[live.creator_id])}
                    style={topFollowButtonStyle}
                  >
                    {followLoadingByCreator[live.creator_id]
                      ? "..."
                      : followingByCreator[live.creator_id]
                        ? "Ne plus suivre"
                        : "Suivre"}
                  </button>
                ) : null}
              </div>
              <div style={{ margin: "8px 0 0", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {live.creator_id ? (
                  <Link href={`/creator/${encodeURIComponent(live.creator_id)}`} style={creatorHandleStyle}>
                    @{live.creator_id.slice(0, 8)}
                  </Link>
                ) : (
                  <p style={{ margin: 0, opacity: 0.95, fontWeight: 700 }}>@createur</p>
                )}
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
                {live.creator_id && live.creator_id === currentUserId ? (
                  <Link href={`/lives/${live.id}`} style={actionStyle}>
                    Ouvrir ce live
                  </Link>
                ) : null}
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
                    <Link href={cameraActionHref} style={goLiveActionStyle}>
                      <span style={cameraIconBadgeStyle} aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="3.5" y="6" width="13" height="12" rx="2.8" fill="white" />
                          <path d="M16.5 10L21 8V16L16.5 14V10Z" fill="white" />
                          <circle cx="10" cy="12" r="3.4" fill="#dc2626" />
                          <circle cx="10" cy="12" r="1.4" fill="white" />
                        </svg>
                      </span>
                      <span style={goLiveLabelStyle}>{cameraActionLabel}</span>
                    </Link>
                  </>
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

          </section>
          </Fragment>
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
            <Link href={cameraActionHref} style={goLiveActionStyle}>
              <span style={cameraIconBadgeStyle} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="6" width="13" height="12" rx="2.8" fill="white" />
                  <path d="M16.5 10L21 8V16L16.5 14V10Z" fill="white" />
                  <circle cx="10" cy="12" r="3.4" fill="#dc2626" />
                  <circle cx="10" cy="12" r="1.4" fill="white" />
                </svg>
              </span>
              <span style={goLiveLabelStyle}>{cameraCreatorLabel}</span>
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

const feedLabelSlideStyle: CSSProperties = {
  minHeight: 84,
  scrollSnapAlign: "start",
  display: "grid",
  placeItems: "center",
  background: "#020617",
  padding: 12,
};

const feedLabelStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.45)",
  background: "rgba(15,23,42,0.85)",
  color: "#e2e8f0",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 0.2,
};

const overlayStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 14,
  padding: 14,
  background: "rgba(15, 23, 42, 0.55)",
  backdropFilter: "blur(4px)",
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
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#dc2626",
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "0 6px 12px rgba(127,29,29,0.35)",
};

const goLiveLabelStyle: CSSProperties = {
  lineHeight: 1,
  fontWeight: 800,
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

const topFollowButtonStyle: CSSProperties = {
  ...inlineActionButtonStyle,
  padding: "7px 11px",
  background: "rgba(37,99,235,0.25)",
  border: "1px solid rgba(147,197,253,0.6)",
  fontSize: 12,
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

const cameraRailLinkStyle: CSSProperties = {
  width: 64,
  minHeight: 64,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#fff",
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  textDecoration: "none",
};

const cameraFeedIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#dc2626",
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "0 8px 18px rgba(220,38,38,0.45)",
};

const actionTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
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

const connectionBannerStyle: CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 108,
  margin: "0 auto 8px",
  width: "fit-content",
  maxWidth: "calc(100% - 24px)",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.88)",
  color: "#e2e8f0",
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.2,
  textAlign: "center",
};

const footerConnectionStyle: CSSProperties = {
  position: "fixed",
  left: 12,
  bottom: 12,
  zIndex: 120,
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.3)",
  background: "rgba(2,6,23,0.86)",
  color: "#cbd5e1",
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 700,
};

const creatorHandleStyle: CSSProperties = {
  margin: 0,
  opacity: 0.95,
  fontWeight: 700,
  color: "#fff",
  textDecoration: "none",
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

function isAiLive(live: LiveRow) {
  const title = (live.title ?? "").trim().toLowerCase();
  return title.includes("live ia") || title.includes("assistante ia") || title.includes("influenceuse ia");
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
