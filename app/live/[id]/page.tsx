"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type AgoraTrack = {
  play: (element?: HTMLElement | string) => void;
};

type AgoraUser = {
  uid: string | number;
  videoTrack?: AgoraTrack;
  audioTrack?: AgoraTrack;
};

type AgoraClient = {
  on: (event: string, handler: (user: AgoraUser, mediaType: string) => Promise<void> | void) => void;
  subscribe: (user: AgoraUser, mediaType: string) => Promise<void>;
  join: (appId: string, channel: string, token: string | null, uid: number | null) => Promise<void>;
  leave: () => Promise<void>;
};

type AgoraSDK = {
  createClient: (config: { mode: "rtc"; codec: "vp8" | "h264" }) => AgoraClient;
};

type PageParams = Promise<{ id?: string }>;

type LiveChatMessage = {
  id: string;
  text: string;
  author: string;
  createdAt: number;
};

type LocalHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

type LiveFallbackConfig = {
  displayName: string;
  posterSrc: string;
  videoSrc: string | null;
};

function getNadiaPosterByVariant(variant: string | null) {
  if (variant === "2") return "/live-ia-nadia-v2.svg";
  if (variant === "1") return "/live-ia-nadia.svg";
  return "/live-ia-nadia-v3.svg";
}

function getFallbackConfigByLiveId(liveId: string, variant: string | null): LiveFallbackConfig {
  const normalized = liveId.trim().toLowerCase();
  if (normalized === "d7a9b66d-3dd9-4b3e-8a1b-f4f6456c1ad6") {
    return {
      displayName: "Nadia",
      posterSrc: getNadiaPosterByVariant(variant),
      videoSrc: "/akoua-fallback.mp4",
    };
  }

  return {
    displayName: "Assistante IA",
    posterSrc: "/live-ia-nadia.svg",
    videoSrc: "/akoua-fallback.mp4",
  };
}

function buildLocalAiFallback(input: string) {
  const text = input.trim().toLowerCase();
  if (!text) return "Je suis l'assistante IA du live ✨ Dis-moi ce que tu veux savoir sur ce live.";
  if (text.includes("prix") || text.includes("tarif") || text.includes("coût")) {
    return "Je suis l'assistante IA du live ✨ Pour les prix/tarifs, je peux te guider selon ton besoin. Donne-moi ton objectif et ton budget.";
  }
  if (text.includes("bonjour") || text.includes("salut") || text.includes("hello")) {
    return "Je suis l'assistante IA du live ✨ Salut 👋 Je suis là en direct. Pose ta question et je te réponds tout de suite.";
  }
  if (text.includes("live") || text.includes("video") || text.includes("cam")) {
    return "Je suis l'assistante IA du live ✨ Ce live est en mode chat sans caméra. Écris-moi ce que tu veux et on avance ensemble.";
  }
  return "Je suis l'assistante IA du live ✨ Bien reçu. Donne-moi un peu plus de détails et je te réponds de façon claire et rapide.";
}

function extractWhatsappFromLink(link: string | null) {
  if (!link) return null;
  const match = link.match(/wa\.me\/(\d{8,})/i);
  return match?.[1] ?? null;
}

export default function LiveViewerPage({ params }: { params: PageParams }) {
  const AI_NAME = "Assistante IA";
  const AI_AUTHOR = "@live_ia";
  const [status, setStatus] = useState("Connexion au live...");
  const [resolvedId, setResolvedId] = useState("");
  const [hasVideo, setHasVideo] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatAuthor, setChatAuthor] = useState("@spectateur");
  const [chatSending, setChatSending] = useState(false);
  const [aiReplying, setAiReplying] = useState(false);
  const [aiHistory, setAiHistory] = useState<LocalHistoryItem[]>([]);
  const [fallbackVideoSrc, setFallbackVideoSrc] = useState<string | null>(null);
  const [fallbackIllustrationSrc, setFallbackIllustrationSrc] = useState<string>("/live-ia-nadia.svg");
  const [liveDisplayName, setLiveDisplayName] = useState<string>(AI_NAME);
  const [fallbackVisualOnly, setFallbackVisualOnly] = useState(false);
  const [creatorWhatsapp, setCreatorWhatsapp] = useState<string | null>(null);
  const [creatorWhatsappLink, setCreatorWhatsappLink] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const welcomeSentRef = useRef(false);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<AgoraClient | null>(null);
  const [isStandaloneIOS, setIsStandaloneIOS] = useState(false);
  const [safariOnlyMode, setSafariOnlyMode] = useState(false);
  const chatChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof createClient>["channel"]>> | null>(null);
  const presenceChannelRef = useRef<ReturnType<NonNullable<ReturnType<typeof createClient>["channel"]>> | null>(null);
  const viewerKeyRef = useRef<string>("");

  const supabaseClient = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    return createClient(url, anonKey);
  }, []);

  const getNextFallbackVideoSrc = (currentSrc: string | null) => {
    if (!currentSrc) return null;
    return null;
  };

  const displayedWhatsapp = creatorWhatsapp ?? extractWhatsappFromLink(creatorWhatsappLink);

  useEffect(() => {
    let active = true;

    const isIOSDevice = () => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      return /iPhone|iPad|iPod/i.test(ua);
    };

    const isStandaloneMode = () => {
      if (typeof window === "undefined") return false;
      const nav = window.navigator as Navigator & { standalone?: boolean };
      return Boolean(nav.standalone) || window.matchMedia("(display-mode: standalone)").matches;
    };

    const fetchViewerToken = async (channel: string) => {
      const tokenResponse = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}&role=subscriber`, {
        cache: "no-store",
      });
      if (tokenResponse.ok) {
        const body = (await tokenResponse.json()) as { token?: string; uid?: number; appId?: string };
        return {
          token: body.token ?? null,
          uid: typeof body.uid === "number" && Number.isFinite(body.uid) ? body.uid : null,
          appId: typeof body.appId === "string" && body.appId.trim() ? body.appId.trim() : null,
        };
      }

      const publisherFallback = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}&role=publisher`, {
        cache: "no-store",
      });
      if (!publisherFallback.ok) return { token: null, uid: null };
      const fallbackBody = (await publisherFallback.json()) as { token?: string; uid?: number; appId?: string };
      return {
        token: fallbackBody.token ?? null,
        uid: typeof fallbackBody.uid === "number" && Number.isFinite(fallbackBody.uid) ? fallbackBody.uid : null,
        appId: typeof fallbackBody.appId === "string" && fallbackBody.appId.trim() ? fallbackBody.appId.trim() : null,
      };
    };

    const connectWithCodec = async (channel: string, appId: string, codec: "vp8" | "h264") => {
      const agoraModule = await import("agora-rtc-sdk-ng");
      const AgoraRTC = (agoraModule.default ?? agoraModule) as unknown as AgoraSDK;
      const client = AgoraRTC.createClient({ mode: "rtc", codec });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (!active) return;

        if (mediaType === "video" && user.videoTrack && remoteVideoRef.current) {
          const player = document.createElement("div");
          player.id = `viewer-${user.uid}`;
          player.style.width = "100%";
          player.style.height = "100%";
          remoteVideoRef.current.innerHTML = "";
          remoteVideoRef.current.appendChild(player);
          user.videoTrack.play(player);
          setHasVideo(true);
          setStatus("EN DIRECT");
        }

        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      let token: string | null = null;
      let joinUid: number | null = null;
      let joinAppId = appId;
      try {
        const tokenInfo = await fetchViewerToken(channel);
        token = tokenInfo.token;
        joinUid = tokenInfo.uid;
        if (tokenInfo.appId) joinAppId = tokenInfo.appId;
      } catch {}

      let joined = false;
      let lastJoinError: unknown = null;
      const tokenCandidates: Array<string | null> = [];
      if (token) tokenCandidates.push(token);
      tokenCandidates.push(null);

      for (const candidate of tokenCandidates) {
        try {
          await client.join(joinAppId, channel, candidate, joinUid);
          joined = true;
          break;
        } catch (joinErr) {
          lastJoinError = joinErr;
          const joinMessage = String(joinErr ?? "").toLowerCase();
          const isAuthError = joinMessage.includes("invalid token") || joinMessage.includes("authorized failed") || joinMessage.includes("4096") || joinMessage.includes("4036");
          if (!isAuthError) throw joinErr;
        }
      }

      if (!joined && lastJoinError) {
        throw lastJoinError;
      }
    };

    const boot = async () => {
      const resolved = await params;
      const liveId = (resolved?.id ?? "").trim();
      const variant = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("variant") : null;
      const fallbackConfig = getFallbackConfigByLiveId(liveId, variant);

      if (!active) return;
      setResolvedId(liveId);
      setHasVideo(false);
      setVideoUnavailable(false);
      setLiveDisplayName(fallbackConfig.displayName || AI_NAME);
      setFallbackIllustrationSrc(fallbackConfig.posterSrc);
      setFallbackVideoSrc(fallbackConfig.videoSrc);
      setFallbackVisualOnly(!fallbackConfig.videoSrc);
      const standaloneIOS = isIOSDevice() && isStandaloneMode();
      setIsStandaloneIOS(standaloneIOS);
      setSafariOnlyMode(standaloneIOS);

      if (standaloneIOS) {
        setStatus("Sur iPhone, ouvrez ce live dans Safari pour une lecture stable.");
        window.setTimeout(() => {
          openInSafari();
        }, 120);
        return;
      }

      if (!liveId) {
        setStatus("Live introuvable.");
        return;
      }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        setStatus("Configuration Agora manquante.");
        return;
      }

      try {
        const codecs: ("vp8" | "h264")[] = isIOSDevice() ? ["h264", "vp8"] : ["vp8", "h264"];
        const channels = Array.from(new Set([liveId, "test-channel"]));

        let connected = false;

        for (const channel of channels) {
          if (connected) break;
          for (const codec of codecs) {
            if (connected) break;
            setStatus(`Connexion... (${channel})`);
            try {
              await connectWithCodec(channel, appId, codec);
              connected = true;
            } catch {
              const existingClient = clientRef.current;
              if (existingClient) {
                try {
                  await existingClient.leave();
                } catch {}
              }
            }
          }
        }

        if (active && connected) {
          setVideoUnavailable(false);
          setStatus("Connecté. En attente de la vidéo...");
        } else if (active && !connected) {
          setVideoUnavailable(true);
          setStatus("Mode chat IA actif (aucun flux vidéo détecté).");
        }
      } catch {
        if (!active) return;
        setVideoUnavailable(true);
        setStatus("Mode chat IA actif (aucun flux vidéo détecté).");
      }
    };

    void boot();

    return () => {
      active = false;
      const client = clientRef.current;
      if (client) {
        void client.leave();
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = "";
      }
    };
  }, [params, retryTick]);

  useEffect(() => {
    if (!resolvedId || !supabaseClient) return;

    let isMounted = true;

    const hydrateAuthor = async () => {
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        if (!isMounted) return;
        if (user?.id) {
          setChatAuthor(`@${user.id.slice(0, 8)}`);
        }
      } catch {}
    };

    void hydrateAuthor();

    const channelName = `live-chat-${resolvedId}`;
    const channel = supabaseClient.channel(channelName, {
      config: { broadcast: { self: true } },
    });

    channel.on("broadcast", { event: "chat-message" }, (payload) => {
      const message = payload.payload as LiveChatMessage;
      if (!message || typeof message.text !== "string" || !message.text.trim()) return;
      setChatMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        const next = [...prev, message];
        return next.slice(-30);
      });
    });

    channel.subscribe();
    chatChannelRef.current = channel;

    return () => {
      isMounted = false;
      if (chatChannelRef.current) {
        void supabaseClient.removeChannel(chatChannelRef.current);
        chatChannelRef.current = null;
      }
    };
  }, [resolvedId, supabaseClient]);

  useEffect(() => {
    if (!resolvedId) {
      setCreatorWhatsapp(null);
      setCreatorWhatsappLink(null);
      return;
    }

    let active = true;

    const loadCreatorWhatsapp = async () => {
      try {
        const response = await fetch(`/api/lives/contact?liveId=${encodeURIComponent(resolvedId)}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) {
            setCreatorWhatsapp(null);
            setCreatorWhatsappLink(null);
          }
          return;
        }

        const body = (await response.json()) as { creatorWhatsapp?: string | null; whatsappLink?: string | null };
        if (!active) return;

        const whatsapp =
          typeof body.creatorWhatsapp === "string" && body.creatorWhatsapp.trim() ? body.creatorWhatsapp.trim() : null;
        const link = typeof body.whatsappLink === "string" && body.whatsappLink.trim() ? body.whatsappLink.trim() : null;
        setCreatorWhatsapp(whatsapp);
        setCreatorWhatsappLink(link);
      } catch {
        if (active) {
          setCreatorWhatsapp(null);
          setCreatorWhatsappLink(null);
        }
      }
    };

    void loadCreatorWhatsapp();

    return () => {
      active = false;
    };
  }, [resolvedId]);

  useEffect(() => {
    if (!resolvedId || welcomeSentRef.current) return;
    welcomeSentRef.current = true;
    const welcomeMessage: LiveChatMessage = {
      id: `welcome-${resolvedId}`,
      text: "Je suis l'assistante IA du live ✨ Je suis en ligne. Écris-moi et je te réponds tout de suite.",
      author: AI_AUTHOR,
      createdAt: Date.now(),
    };
    setChatMessages((prev) => [...prev, welcomeMessage].slice(-30));
  }, [resolvedId]);

  useEffect(() => {
    if (hasVideo || safariOnlyMode) return;

    const timer = window.setTimeout(() => {
      setVideoUnavailable(true);
      setStatus("Mode chat IA actif (aucun flux vidéo détecté).");
    }, 7000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasVideo, safariOnlyMode, resolvedId, retryTick]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        const liveSwRegistrations = registrations.filter((registration) =>
          registration.active?.scriptURL?.includes("/live-sw.js")
        );

        return Promise.all(
          liveSwRegistrations.map((registration) => registration.unregister())
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!resolvedId || !supabaseClient) return;

    if (!viewerKeyRef.current && typeof window !== "undefined") {
      const stored = window.localStorage.getItem("pitch_viewer_key");
      if (stored && stored.trim()) {
        viewerKeyRef.current = stored;
      } else {
        const generated = `viewer-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
        viewerKeyRef.current = generated;
        window.localStorage.setItem("pitch_viewer_key", generated);
      }
    }

    const channel = supabaseClient.channel("live-presence-global", {
      config: { presence: { key: viewerKeyRef.current || undefined } },
    });

    const trackPresence = async () => {
      await channel.track({
        role: "spectator",
        liveId: resolvedId,
        lastSeenAt: new Date().toISOString(),
      });
    };

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void trackPresence();
      }
    });

    const timer = window.setInterval(() => {
      void trackPresence();
    }, 20000);

    presenceChannelRef.current = channel;

    return () => {
      window.clearInterval(timer);
      if (presenceChannelRef.current) {
        void supabaseClient.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [resolvedId, supabaseClient]);

  const openInSafari = () => {
    if (typeof window === "undefined") return;
    const current = `${window.location.origin}${window.location.pathname}`;
    window.open(current, "_blank", "noopener,noreferrer");
  };

  const shareLive = async () => {
    if (!resolvedId || typeof window === "undefined") return;
    const url = `${window.location.origin}/live/${encodeURIComponent(resolvedId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pitch Live", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setShareMessage("Lien partagé ✅");
      window.setTimeout(() => setShareMessage(null), 1600);
    } catch {
      setShareMessage("Partage annulé");
      window.setTimeout(() => setShareMessage(null), 1200);
    }
  };

  const focusChat = () => {
    const target = chatInputRef.current;
    if (!target) return;
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;
    setChatSending(true);

    const message: LiveChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.slice(0, 220),
      author: chatAuthor,
      createdAt: Date.now(),
    };

    try {
      setChatMessages((prev) => [...prev, message].slice(-30));
      setChatInput("");

      if (chatChannelRef.current) {
        void chatChannelRef.current.send({
          type: "broadcast",
          event: "chat-message",
          payload: message,
        });
      }

      const effectiveLiveId =
        resolvedId ||
        (typeof window !== "undefined"
          ? window.location.pathname.split("/").filter(Boolean).at(-1) || ""
          : "");

      if (!effectiveLiveId) {
        const instantText = buildLocalAiFallback(text);
        const instantMessage: LiveChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: instantText.slice(0, 220),
          author: AI_AUTHOR,
          createdAt: Date.now(),
        };
        setChatMessages((prev) => [...prev, instantMessage].slice(-30));
        return;
      }

      if (aiReplying) {
        const instantText = buildLocalAiFallback(text);
        const instantMessage: LiveChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: instantText.slice(0, 220),
          author: AI_AUTHOR,
          createdAt: Date.now(),
        };
        setChatMessages((prev) => [...prev, instantMessage].slice(-30));
        return;
      }
      setAiReplying(true);

      const userTurn: LocalHistoryItem = { role: "user", content: text.slice(0, 500) };
      const nextHistory: LocalHistoryItem[] = [...aiHistory, userTurn].slice(-12);

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);
        let replyRes: Response;

        try {
          replyRes = await fetch("/api/live-ai/reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              liveId: effectiveLiveId,
              message: text,
              history: nextHistory,
            }),
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

        const replyBody = (await replyRes.json()) as { reply?: string; error?: string };
        const replyText = (replyBody.reply || "").trim();

        const finalReplyText = replyRes.ok && replyText ? replyText : buildLocalAiFallback(text);

        const assistantMessage: LiveChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: finalReplyText.slice(0, 220),
          author: AI_AUTHOR,
          createdAt: Date.now(),
        };

        setChatMessages((prev) => [...prev, assistantMessage].slice(-30));

        if (chatChannelRef.current) {
          void chatChannelRef.current.send({
            type: "broadcast",
            event: "chat-message",
            payload: assistantMessage,
          });
        }

        const assistantTurn: LocalHistoryItem = { role: "assistant", content: finalReplyText.slice(0, 500) };
        const withAssistant: LocalHistoryItem[] = [...nextHistory, assistantTurn].slice(-12);
        setAiHistory(withAssistant);
      } catch {
        const fallbackText = buildLocalAiFallback(text);
        const fallbackMessage: LiveChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: fallbackText.slice(0, 220),
          author: AI_AUTHOR,
          createdAt: Date.now(),
        };

        setChatMessages((prev) => [...prev, fallbackMessage].slice(-30));

        if (chatChannelRef.current) {
          try {
            await chatChannelRef.current.send({
              type: "broadcast",
              event: "chat-message",
              payload: fallbackMessage,
            });
          } catch {}
        }

        const assistantTurn: LocalHistoryItem = { role: "assistant", content: fallbackText.slice(0, 500) };
        setAiHistory([...nextHistory, assistantTurn].slice(-12));
      } finally {
        setAiReplying(false);
      }
    } finally {
      setChatSending(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/watch" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 700 }}>
          ← Retour au flux
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {displayedWhatsapp ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.82)",
                color: "#86efac",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
              aria-label="Numéro WhatsApp du créateur"
            >
              WhatsApp: {displayedWhatsapp}
            </span>
          ) : null}
          {creatorWhatsappLink ? (
            <a
              href={creatorWhatsappLink}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: 999,
                textDecoration: "none",
                background: "#22c55e",
                color: "#052e16",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
              aria-label="Contacter le créateur sur WhatsApp"
            >
              {displayedWhatsapp ? `Écrire ${displayedWhatsapp}` : "Écrire"}
            </a>
          ) : null}
          <span style={{ fontSize: 13, opacity: 0.9 }}>{hasVideo ? "EN DIRECT" : "LIVE IA (SANS CAMÉRA)"}</span>
        </div>
      </header>
      <section className="live-video-shell" style={{ padding: 12 }}>
        <div
          ref={remoteVideoRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "radial-gradient(circle at 50% 20%, #0f172a 0%, #020617 55%, #000 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {!hasVideo && fallbackVideoSrc ? (
            <video
              key={fallbackVideoSrc ?? "fallback-video"}
              autoPlay
              muted
              loop
              controls
              playsInline
              preload="auto"
              poster={fallbackIllustrationSrc}
              src={fallbackVideoSrc}
              onError={() => {
                const nextSrc = getNextFallbackVideoSrc(fallbackVideoSrc);
                if (nextSrc) {
                  setFallbackVideoSrc(nextSrc);
                } else {
                  setFallbackVisualOnly(true);
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.82,
                background: "#f8fafc",
              }}
            />
          ) : null}
          {!hasVideo ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateRows: safariOnlyMode ? "1fr" : "1fr auto",
                gap: 10,
                padding: 10,
                background: "rgba(2,6,23,0.2)",
              }}
            >
              {!safariOnlyMode && !fallbackVisualOnly ? (
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(147,197,253,0.45)",
                    background: "#020617",
                  }}
                >
                  <video
                    key={`main-${fallbackVideoSrc ?? "fallback-video"}`}
                    autoPlay
                    muted
                    loop
                    controls
                    playsInline
                    preload="auto"
                    poster={fallbackIllustrationSrc}
                    src={fallbackVideoSrc ?? undefined}
                    onError={() => {
                      const nextSrc = getNextFallbackVideoSrc(fallbackVideoSrc);
                      if (nextSrc) {
                        setFallbackVideoSrc(nextSrc);
                      } else {
                        setFallbackVisualOnly(true);
                      }
                    }}
                    style={{ width: "100%", height: "100%", minHeight: 260, objectFit: "cover", display: "block", background: "#f8fafc" }}
                  />
                </div>
              ) : null}

              {!safariOnlyMode && fallbackVisualOnly ? (
                <div
                  style={{
                    minHeight: 260,
                    borderRadius: 12,
                    border: "1px solid rgba(147,197,253,0.45)",
                    background: "#f8fafc",
                    display: "grid",
                    placeItems: "center",
                    textAlign: "center",
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  <img src={fallbackIllustrationSrc} alt="Illustration live IA" style={{ width: "100%", height: "100%", minHeight: 260, objectFit: "cover", display: "block" }} />
                </div>
              ) : null}

              <div
                style={{
                  border: "1px solid rgba(147,197,253,0.45)",
                  borderRadius: 12,
                  padding: "12px 12px",
                  background: "rgba(2,6,23,0.8)",
                  textAlign: "center",
                }}
              >
                <strong style={{ color: "#bfdbfe" }}>{liveDisplayName} • Live IA</strong>
                <p style={{ margin: "8px 0 10px", fontWeight: 700 }}>{status}</p>
                <p style={{ margin: "0 0 10px", color: "#e2e8f0", fontSize: 13, lineHeight: 1.35 }}>
                  Ce live fonctionne sans caméra quand aucun flux créateur n'est détecté. Écris en bas pour discuter avec l'IA en direct.
                </p>
                {safariOnlyMode ? (
                  <button
                    type="button"
                    onClick={openInSafari}
                    style={{
                      border: "1px solid rgba(255,255,255,0.28)",
                      borderRadius: 999,
                      padding: "8px 13px",
                      background: "rgba(15,23,42,0.8)",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Ouvrir dans Safari
                  </button>
                ) : (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={focusChat}
                      style={{
                        border: "1px solid rgba(147,197,253,0.45)",
                        borderRadius: 999,
                        padding: "9px 14px",
                        background: "rgba(15,23,42,0.88)",
                        color: "#fff",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Ouvrir le chat IA
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {shareMessage ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)",
            transform: "translateX(-50%)",
            borderRadius: 999,
            padding: "8px 12px",
            background: "rgba(15,23,42,0.84)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            zIndex: 13,
          }}
        >
          {shareMessage}
        </div>
      ) : null}

      <section
        style={{
          position: "fixed",
          left: 12,
          right: 12,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
          zIndex: 14,
          display: "grid",
          gap: 8,
        }}
      >
        <div
          style={{
            maxHeight: 150,
            overflowY: "auto",
            display: "grid",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          {chatMessages.slice(-8).map((message) => (
            <div
              key={message.id}
              style={{
                width: "fit-content",
                maxWidth: "100%",
                padding: "6px 10px",
                borderRadius: 10,
                background: "rgba(2,6,23,0.72)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#fff",
                fontSize: 12,
                lineHeight: 1.35,
              }}
            >
              <strong style={{ color: "#93c5fd" }}>{message.author}</strong> {message.text}
            </div>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendChatMessage();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input
            ref={chatInputRef}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendChatMessage();
              }
            }}
            placeholder="Saisis ton message"
            maxLength={220}
            enterKeyHint="send"
            style={{
              flex: 1,
              minWidth: 0,
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.45)",
              padding: "11px 14px",
              background: "rgba(2,6,23,0.78)",
              color: "#fff",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => setLiked((value) => !value)}
            style={chatSideActionButtonStyle}
            aria-label="Like"
          >
            {liked ? "❤️" : "🤍"}
          </button>
          <button type="button" onClick={() => void shareLive()} style={chatSideActionButtonStyle} aria-label="Partager">
            ↗️
          </button>
          <button
            type="submit"
            disabled={chatSending || !chatInput.trim()}
            aria-label="Envoyer"
            style={{
              borderRadius: 999,
              border: "1px solid rgba(147,197,253,0.55)",
              width: 42,
              minWidth: 42,
              height: 42,
              padding: 0,
              background: "rgba(37,99,235,0.88)",
              color: "#fff",
              fontWeight: 700,
              whiteSpace: "nowrap",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              cursor: chatSending || !chatInput.trim() ? "not-allowed" : "pointer",
              opacity: chatSending || !chatInput.trim() ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M6.8 12.2L12 7L17.2 12.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </section>

      <style jsx>{`
        .live-video-shell {
          height: calc(100vh - 64px - env(safe-area-inset-bottom, 0px));
        }

        @media (max-width: 640px) {
          .live-video-shell {
            height: calc(100vh - 64px - env(safe-area-inset-bottom, 0px) - 12px);
          }
        }
      `}</style>

    </main>
  );
}

const chatSideActionButtonStyle = {
  width: 42,
  minWidth: 42,
  height: 42,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(15, 23, 42, 0.7)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 18,
  flexShrink: 0,
  cursor: "pointer",
} as const;
