"use client";

import { useEffect, useMemo, useState } from "react";

type PlatformStatsResponse = {
  creators: number;
  replays: number;
  liveNow: number;
  source: "connected" | "degraded" | "disconnected";
};

const defaultStats: PlatformStatsResponse = {
  creators: 6,
  replays: 24,
  liveNow: 0,
  source: "disconnected",
};

export default function LiveHeroStats() {
  const [stats, setStats] = useState<PlatformStatsResponse>(defaultStats);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/lives/platform-stats", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as Partial<PlatformStatsResponse>;
        setStats({
          creators: typeof body.creators === "number" ? body.creators : defaultStats.creators,
          replays: typeof body.replays === "number" ? body.replays : defaultStats.replays,
          liveNow: typeof body.liveNow === "number" ? body.liveNow : defaultStats.liveNow,
          source: body.source === "connected" || body.source === "degraded" || body.source === "disconnected" ? body.source : defaultStats.source,
        });
      } catch {
        setStats(defaultStats);
      }
    };

    void load();
  }, []);

  const statusLabel = useMemo(() => {
    if (stats.source === "connected") return "🟢 Connecté à la base";
    if (stats.source === "degraded") return "🟡 Mode dégradé";
    return "🔵 Mode démo";
  }, [stats.source]);

  return (
    <div
      style={{
        margin: "24px auto 0",
        maxWidth: 760,
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.25)",
          background: "rgba(15,23,42,0.5)",
          color: "#cbd5e1",
          fontWeight: 700,
          padding: "8px 12px",
          textAlign: "center",
        }}
      >
        {statusLabel}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          alignItems: "center",
          gap: 8,
        }}
      >
        {[
          { value: String(stats.creators), label: "Créateurs" },
          { value: String(stats.replays), label: "Replays" },
          { value: String(stats.liveNow), label: "Live Now" },
        ].map((item, index) => (
          <div
            key={item.label}
            style={{
              borderLeft: index === 0 ? "none" : "1px solid rgba(148,163,184,0.26)",
              paddingLeft: index === 0 ? 0 : 14,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "clamp(24px, 5vw, 56px)", fontWeight: 800, lineHeight: 1 }}>{item.value}</div>
            <div style={{ marginTop: 6, color: "#94a3b8", fontSize: "clamp(14px, 2.2vw, 20px)", fontWeight: 500 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
