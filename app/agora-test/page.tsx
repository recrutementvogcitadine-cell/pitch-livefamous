"use client";

import React, { useRef, useState } from "react";

type ResolutionOption = { label: string; width: number; height: number; fps: number };

const RESOLUTIONS: ResolutionOption[] = [
  { label: "QVGA (320x240)", width: 320, height: 240, fps: 15 },
  { label: "VGA (640x480)", width: 640, height: 480, fps: 15 },
  { label: "HD (1280x720)", width: 1280, height: 720, fps: 30 },
];

export default function AgoraTestPage() {
  const [status, setStatus] = useState("idle");
  const [codec, setCodec] = useState<"vp8" | "h264">("vp8");
  const [resolutionIdx, setResolutionIdx] = useState(1);
  const [layout, setLayout] = useState<"grid" | "large-local" | "pip">("grid");

  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<any>(null);
  const localTracksRef = useRef<any>(null);

  function applyLayoutSizing() {
    const res = RESOLUTIONS[resolutionIdx];
    const width = Math.min(res.width, 640);
    const height = Math.min(res.height, 480);
    // local
    const local = document.getElementById('local-player');
    const remotes = remoteVideoRef.current?.querySelectorAll('[id^="player-"]') || [];

    if (layout === 'grid') {
      if (local) { local.style.width = width / 2 + 'px'; local.style.height = height / 2 + 'px'; }
      remotes.forEach((r: any) => { r.style.width = width / 2 + 'px'; r.style.height = height / 2 + 'px'; });
    } else if (layout === 'large-local') {
      if (local) { local.style.width = width + 'px'; local.style.height = height + 'px'; }
      remotes.forEach((r: any) => { r.style.width = Math.floor(width / 3) + 'px'; r.style.height = Math.floor(height / 3) + 'px'; });
    } else if (layout === 'pip') {
      if (local) { local.style.width = Math.floor(width / 3) + 'px'; local.style.height = Math.floor(height / 3) + 'px'; local.style.position = 'absolute'; local.style.right = '12px'; local.style.bottom = '12px'; }
      remotes.forEach((r: any) => { r.style.width = width + 'px'; r.style.height = height + 'px'; });
    }
  }

  async function join() {
    setStatus("loading");
    try {
      const AgoraModule = await import("agora-rtc-sdk-ng");
      const AgoraRTC = (AgoraModule && (AgoraModule.default ?? AgoraModule)) as any;
      const appId = (document.getElementById("appId") as HTMLInputElement).value.trim();
      let token = (document.getElementById("token") as HTMLInputElement).value.trim() || null;
      const channel = (document.getElementById("channel") as HTMLInputElement).value.trim() || "test-channel";
      if (!appId) {
        setStatus("error: appId required");
        return;
      }

      const client = AgoraRTC.createClient({ mode: "rtc", codec });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: any) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          const remoteContainer = remoteVideoRef.current!;
          const player = document.createElement('div');
          player.id = `player-${user.uid}`;
          player.style.width = '320px';
          player.style.height = '240px';
          remoteContainer.appendChild(player);
          try { user.videoTrack.play(player); } catch (e) { console.warn('play remote failed', e); }
          applyLayoutSizing();
        }
      });

      // If no token provided by user, try fetching from server endpoint
      if (!token) {
        try {
          const res = await fetch(`/api/agora/token?channel=${encodeURIComponent(channel)}`);
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

      const res = RESOLUTIONS[resolutionIdx];
      // Try to request camera with constraints via encoderConfig; fallback to default
      let micTrack: any, camTrack: any;
      try {
        // preferred API: createMicrophoneAndCameraTracks with cameraConfig
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
          {},
          { encoderConfig: { width: res.width, height: res.height, frameRate: res.fps } }
        );
        [micTrack, camTrack] = tracks;
      } catch (e) {
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
      setStatus('joined');
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
      <p>Contrôlez la résolution, le codec et le layout d'affichage avant de rejoindre.</p>
      <div style={{display:'grid',gap:8,maxWidth:720}}>
        <input id="appId" placeholder="Agora APP ID" defaultValue={process.env.NEXT_PUBLIC_AGORA_APP_ID ?? ''} />
        <input id="token" placeholder="Token (optional)" />
        <input id="channel" placeholder="Channel (default: test-channel)" />

        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label>Codec:</label>
          <select value={codec} onChange={(e)=>setCodec(e.target.value as any)}>
            <option value="vp8">VP8</option>
            <option value="h264">H.264</option>
          </select>
          <label>Résolution:</label>
          <select value={String(resolutionIdx)} onChange={(e)=>setResolutionIdx(Number(e.target.value))}>
            {RESOLUTIONS.map((r, idx) => <option key={r.label} value={idx}>{r.label}</option>)}
          </select>
          <label>Layout:</label>
          <select value={layout} onChange={(e)=>setLayout(e.target.value as any)}>
            <option value="grid">Grid</option>
            <option value="large-local">Large local</option>
            <option value="pip">PiP (local small)</option>
          </select>
        </div>

        <div>
          <button onClick={join} style={{marginRight:8}}>Join</button>
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
