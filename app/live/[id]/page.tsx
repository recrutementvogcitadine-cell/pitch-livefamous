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
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<AgoraClient | null>(null);

  useEffect(() => {
    let active = true;

    const isIOSDevice = () => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      return /iPhone|iPad|iPod/i.test(ua);
    };

    const fetchViewerToken = async (liveId: string) => {
      const tokenResponse = await fetch(`/api/agora/token?channel=${encodeURIComponent(liveId)}&role=subscriber`, {
        cache: "no-store",
      });
      if (!tokenResponse.ok) return null;
      const body = (await tokenResponse.json()) as { token?: string };
      return body.token ?? null;
    };

    const connectWithCodec = async (liveId: string, appId: string, codec: "vp8" | "h264") => {
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
          setStatus("EN DIRECT");
        }

        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      let token: string | null = null;
      try {
        token = await fetchViewerToken(liveId);
      } catch {}

      await client.join(appId, liveId, token, null);
    };

    const boot = async () => {
      const resolved = await params;
      const liveId = (resolved?.id ?? "").trim();

      if (!active) return;
      setResolvedId(liveId);

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
        const primaryCodec: "vp8" | "h264" = isIOSDevice() ? "h264" : "vp8";
        const fallbackCodec: "vp8" | "h264" = primaryCodec === "h264" ? "vp8" : "h264";

        try {
          await connectWithCodec(liveId, appId, primaryCodec);
        } catch {
          const existingClient = clientRef.current;
          if (existingClient) {
            try {
              await existingClient.leave();
            } catch {}
          }
          await connectWithCodec(liveId, appId, fallbackCodec);
        }

        if (active) {
          setStatus("Connecté. En attente de la vidéo...");
        }
      } catch (error: unknown) {
        if (!active) return;
        setStatus(`Erreur de lecture: ${error instanceof Error ? error.message : String(error)}`);
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
  }, [params]);

  return (
    <main style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Link href="/watch" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 700 }}>
          ← Retour au flux
        </Link>
        <span style={{ fontSize: 13, opacity: 0.9 }}>{status}</span>
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
          }}
        />
      </section>

      {resolvedId ? (
        <p style={{ position: "fixed", left: 12, bottom: 10, margin: 0, fontSize: 11, opacity: 0.65 }}>
          Canal: {resolvedId}
        </p>
      ) : null}
    </main>
  );
}
