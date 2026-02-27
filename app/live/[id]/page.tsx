"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  join: (appId: string, channel: string, token: string | null, uid: null) => Promise<void>;
  leave: () => Promise<void>;
};

type AgoraSDK = {
  createClient: (config: { mode: "rtc"; codec: "vp8" | "h264" }) => AgoraClient;
};

type PageParams = { id?: string } | Promise<{ id?: string }>;

export default function LiveViewerPage({ params }: { params: PageParams }) {
  const [status, setStatus] = useState("Connexion au live...");
  const [resolvedId, setResolvedId] = useState("");
  const [hasVideo, setHasVideo] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<AgoraClient | null>(null);
  const [isStandaloneIOS, setIsStandaloneIOS] = useState(false);

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
        const body = (await tokenResponse.json()) as { token?: string };
        return body.token ?? null;
      }

      const publisherFallback = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}&role=publisher`, {
        cache: "no-store",
      });
      if (!publisherFallback.ok) return null;
      const fallbackBody = (await publisherFallback.json()) as { token?: string };
      return fallbackBody.token ?? null;
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
      try {
        token = await fetchViewerToken(channel);
      } catch {}

      await client.join(appId, channel, token, null);
    };

    const boot = async () => {
      const resolved = await params;
      const liveId = (resolved?.id ?? "").trim();

      if (!active) return;
      setResolvedId(liveId);
      setHasVideo(false);
      setIsStandaloneIOS(isIOSDevice() && isStandaloneMode());

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
          setStatus("Connecté. En attente de la vidéo...");
        } else if (active && !connected) {
          setStatus("Impossible de se connecter au live. Touchez Réessayer.");
        }
      } catch {
        if (!active) return;
        setStatus("Lecture indisponible pour le moment. Touchez Réessayer.");
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

  const openInSafari = () => {
    if (typeof window === "undefined") return;
    const current = window.location.href;
    window.open(current, "_blank", "noopener,noreferrer");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/watch" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 700 }}>
          ← Retour au flux
        </Link>
        <span style={{ fontSize: 13, opacity: 0.9 }}>{hasVideo ? "EN DIRECT" : "Chargement"}</span>
      </header>

      <section style={{ height: "calc(100vh - 64px)", padding: 12 }}>
        <div
          ref={remoteVideoRef}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "radial-gradient(circle at 30% 20%, #1d4ed8 0%, #0f172a 45%, #020617 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {!hasVideo ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                padding: 18,
                background: "rgba(2,6,23,0.35)",
              }}
            >
              <div style={{ maxWidth: 320 }}>
                <p style={{ margin: "0 0 10px", fontWeight: 700 }}>{status}</p>
                <button
                  type="button"
                  onClick={() => setRetryTick((value) => value + 1)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 999,
                    padding: "9px 14px",
                    background: "rgba(37,99,235,0.85)",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Réessayer
                </button>
                {isStandaloneIOS ? (
                  <div style={{ marginTop: 10 }}>
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
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {resolvedId ? (
        <p style={{ position: "fixed", left: 12, bottom: 10, margin: 0, fontSize: 11, opacity: 0.65 }}>
          Canal: {resolvedId}
        </p>
      ) : null}
    </main>
  );
}
