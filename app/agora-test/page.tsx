"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type ResolutionOption = { label: string; width: number; height: number; fps: number };
type AgoraTrack = {
  stop: () => void | Promise<void>;
  close: () => void;
  play: (element: HTMLElement | string) => void;
};
type AgoraUser = { uid: string | number; videoTrack?: AgoraTrack };
type AgoraClient = {
  on: (event: string, handler: (user: AgoraUser, mediaType: string) => Promise<void> | void) => void;
  subscribe: (user: AgoraUser, mediaType: string) => Promise<void>;
  join: (appId: string, channel: string, token: string | null, uid: null) => Promise<void>;
  publish: (tracks: AgoraTrack[]) => Promise<void>;
  leave: () => Promise<void>;
};
type AgoraSDK = {
  createClient: (config: { mode: "rtc"; codec: "vp8" | "h264" }) => AgoraClient;
  createMicrophoneAndCameraTracks: (
    audioConfig?: Record<string, never>,
    videoConfig?: { encoderConfig: { width: number; height: number; frameRate: number } }
  ) => Promise<[AgoraTrack, AgoraTrack]>;
};

function normalizeWhatsapp(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\d+]/g, "").trim();
}

function isValidWhatsapp(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length >= 8;
}

const RESOLUTIONS: ResolutionOption[] = [
  { label: "QVGA (320x240)", width: 320, height: 240, fps: 15 },
  { label: "VGA (640x480)", width: 640, height: 480, fps: 15 },
  { label: "HD (1280x720)", width: 1280, height: 720, fps: 30 },
];

export default function AgoraTestPage() {
  const [status, setStatus] = useState("idle");
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [codec, setCodec] = useState<"vp8" | "h264">("vp8");
  const [resolutionIdx, setResolutionIdx] = useState(1);
  const [layout, setLayout] = useState<"grid" | "large-local" | "pip">("grid");

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<AgoraClient | null>(null);
  const localTracksRef = useRef<{ micTrack: AgoraTrack; camTrack: AgoraTrack } | null>(null);

  function supabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }

  async function ensureCreatorLiveAccess() {
    const supabase = supabaseClient();
    if (!supabase) {
      setStatus("error: config Supabase manquante");
      setUpgradeRequired(true);
      return false;
    }

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) {
      setStatus("Accès live caméra réservé aux créateurs connectés.");
      setUpgradeRequired(true);
      return false;
    }

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const isCreator =
      meta.account_type === "creator" ||
      meta.account_type === "creator_pending" ||
      meta.account_type === "seller";
    const creatorVerified = Boolean(meta.creator_verified) || Boolean(meta.seller_active);
    const creatorWhatsapp = normalizeWhatsapp(meta.creator_whatsapp);

    if (!isCreator || !creatorVerified) {
      setStatus("Pour passer en live caméra, demandez le mode créateur puis attendez la validation admin.");
      setUpgradeRequired(true);
      return false;
    }

    if (!isValidWhatsapp(creatorWhatsapp)) {
      setStatus("WhatsApp obligatoire: renseignez un numéro valide dans votre profil créateur avant de passer en live.");
      setUpgradeRequired(true);
      return false;
    }

    setUpgradeRequired(false);
    return true;
  }

  function applyLayoutSizing() {
    const res = RESOLUTIONS[resolutionIdx];
    const width = Math.min(res.width, 640);
    const height = Math.min(res.height, 480);
    // local
    const local = document.getElementById('local-player');
    const remotes = remoteVideoRef.current?.querySelectorAll<HTMLElement>('[id^="player-"]') || [];

    if (layout === 'grid') {
      if (local) { local.style.width = width / 2 + 'px'; local.style.height = height / 2 + 'px'; }
      remotes.forEach((r) => { r.style.width = width / 2 + 'px'; r.style.height = height / 2 + 'px'; });
    } else if (layout === 'large-local') {
      if (local) { local.style.width = width + 'px'; local.style.height = height + 'px'; }
      remotes.forEach((r) => { r.style.width = Math.floor(width / 3) + 'px'; r.style.height = Math.floor(height / 3) + 'px'; });
    } else if (layout === 'pip') {
      if (local) { local.style.width = Math.floor(width / 3) + 'px'; local.style.height = Math.floor(height / 3) + 'px'; local.style.position = 'absolute'; local.style.right = '12px'; local.style.bottom = '12px'; }
      remotes.forEach((r) => { r.style.width = width + 'px'; r.style.height = height + 'px'; });
    }
  }

  async function join(mode: "spectator" | "seller-live") {
    if (mode === "seller-live") {
      const allowed = await ensureCreatorLiveAccess();
      if (!allowed) return;
    }

    setStatus("loading");
    try {
      const AgoraModule = await import("agora-rtc-sdk-ng");
      const AgoraRTC = (AgoraModule && (AgoraModule.default ?? AgoraModule)) as unknown as AgoraSDK;
      const appId = (document.getElementById("appId") as HTMLInputElement).value.trim();
      let token = (document.getElementById("token") as HTMLInputElement).value.trim() || null;
      const channel = (document.getElementById("channel") as HTMLInputElement).value.trim() || "test-channel";
      if (!appId) {
        setStatus("error: appId required");
        return;
      }

      const client = AgoraRTC.createClient({ mode: "rtc", codec });
      clientRef.current = client;

      client.on("user-published", async (user: AgoraUser, mediaType: string) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          const remoteContainer = remoteVideoRef.current!;
          const player = document.createElement('div');
          player.id = `player-${user.uid}`;
          player.style.width = '320px';
          player.style.height = '240px';
          remoteContainer.appendChild(player);
          if (user.videoTrack) {
            try { user.videoTrack.play(player); } catch (e) { console.warn('play remote failed', e); }
          }
          applyLayoutSizing();
        }
      });

      const roleParam = mode === "spectator" ? "subscriber" : "publisher";

      // If no token provided by user, try fetching from server endpoint
      if (!token) {
        try {
          const res = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}&role=${roleParam}`);
          if (res.ok) {
            const body = await res.json();
            token = body.token ?? token;
          } else {
            console.warn('token endpoint responded with', res.status);
          }
        } catch (e) {
          console.warn('failed to fetch token', e);
        }
      }

      await client.join(appId, channel, token, null);

      if (mode === "spectator") {
        setStatus("spectateur connecté");
        return;
      }

      const res = RESOLUTIONS[resolutionIdx];
      // Try to request camera with constraints via encoderConfig; fallback to default
      let micTrack: AgoraTrack;
      let camTrack: AgoraTrack;
      try {
        // preferred API: createMicrophoneAndCameraTracks with cameraConfig
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          { encoderConfig: { width: res.width, height: res.height, frameRate: res.fps } }
        );
        [micTrack, camTrack] = tracks;
      } catch {
        // fallback
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        [micTrack, camTrack] = tracks;
      }

      localTracksRef.current = { micTrack, camTrack };
      const localContainer = localVideoRef.current!;
      localContainer.innerHTML = '';
      const localPlayer = document.createElement('div');
      localPlayer.id = 'local-player';
      localPlayer.style.width = '320px';
      localPlayer.style.height = '240px';
      localContainer.appendChild(localPlayer);
      try { camTrack.play(localPlayer); } catch (e) { console.warn('play local failed', e); }
      await client.publish([micTrack, camTrack]);
      setStatus('live caméra actif');
      applyLayoutSizing();
    } catch (err) {
      setStatus('error: ' + String(err));
    }
  }

  async function leave() {
    setStatus('leaving');
    try {
      const client = clientRef.current;
      if (localTracksRef.current) {
        try { await localTracksRef.current.micTrack.stop(); } catch {}
        try { await localTracksRef.current.camTrack.stop(); } catch {}
        try { localTracksRef.current.micTrack.close(); } catch {}
        try { localTracksRef.current.camTrack.close(); } catch {}
      }
      if (client) await client.leave();
      clientRef.current = null;
      localTracksRef.current = null;
      if (localVideoRef.current) localVideoRef.current.innerHTML = '';
      if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = '';
      setStatus('left');
    } catch (err) {
      setStatus('error: ' + String(err));
    }
  }

  return (
    <main style={{padding:24,fontFamily:'system-ui,sans-serif'}}>
      <h1>Agora Test — affichage vidéo adaptatif</h1>
      <p>Les spectateurs peuvent rejoindre sans caméra. Le passage en live caméra est réservé aux créateurs validés.</p>

      {upgradeRequired ? (
        <div style={{ marginBottom: 12, padding: 12, border: '1px solid #fecaca', background: '#fff1f2', borderRadius: 10 }}>
          <strong>Validation créateur requise</strong>
          <p style={{ margin: '6px 0' }}>
            Pour activer la caméra et passer en live, envoyez votre demande créateur puis contactez l&apos;admin sur WhatsApp pour vérification.
          </p>
          <Link href="/auth?mode=creator" style={{ color: '#1d4ed8', fontWeight: 700 }}>
            Aller vers profil créateur
          </Link>
        </div>
      ) : null}

      <div style={{display:'grid',gap:8,maxWidth:720}}>
        <input id="appId" placeholder="Agora APP ID" defaultValue={process.env.NEXT_PUBLIC_AGORA_APP_ID ?? ''} />
        <input id="token" placeholder="Token (optional)" />
        <input id="channel" placeholder="Channel (default: test-channel)" />

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label>Codec:</label>
          <select value={codec} onChange={(e)=>setCodec(e.target.value as "vp8" | "h264")}>
            <option value="vp8">VP8</option>
            <option value="h264">H.264</option>
          </select>
          <label>Résolution:</label>
          <select value={String(resolutionIdx)} onChange={(e)=>setResolutionIdx(Number(e.target.value))}>
            {RESOLUTIONS.map((r, idx) => <option key={r.label} value={idx}>{r.label}</option>)}
          </select>
          <label>Layout:</label>
          <select value={layout} onChange={(e)=>setLayout(e.target.value as "grid" | "large-local" | "pip")}>
            <option value="grid">Grid</option>
            <option value="large-local">Large local</option>
            <option value="pip">PiP (local small)</option>
          </select>
        </div>

        <div>
          <button onClick={() => join('spectator')} style={{marginRight:8}}>Rejoindre comme spectateur</button>
          <button onClick={() => join('seller-live')} style={{marginRight:8}}>Passer en live (créateur)</button>
          <button onClick={leave}>Leave</button>
          <button onClick={applyLayoutSizing} style={{marginLeft:8}}>Appliquer layout</button>
        </div>

        <div>Statut: {status}</div>
        <div style={{fontSize:12,color:'#666'}}>Token source: {typeof window !== 'undefined' && (document.getElementById('token') as HTMLInputElement)?.value ? 'manual' : 'server (if available)'}</div>

        <div style={{position:'relative',display:'flex',gap:12,marginTop:12,flexWrap:'wrap'}}>
          <div style={{minWidth:100}}>
            <div>Local</div>
            <div ref={localVideoRef}></div>
          </div>
          <div style={{flex:1}}>
            <div>Remote</div>
            <div ref={remoteVideoRef}></div>
          </div>
        </div>
      </div>
    </main>
  );
}
