"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";

function base64UrlToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function LiveNotificationControls() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!client) throw new Error("Configuration Supabase manquante.");

      const {
        data: { user },
      } = await client.auth.getUser();

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!user) throw new Error("Connectez-vous pour activer les notifications.");
      if (!("serviceWorker" in navigator)) throw new Error("Service Worker non supporté sur cet appareil.");

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY manquant.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Autorisez les notifications pour continuer.");

      const registration = await navigator.serviceWorker.register("/live-sw.js", { scope: "/" });
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));

      const response = await fetch("/api/live-notify/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ subscription }),
      });

      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Impossible d’enregistrer la notification.");
      }

      setMessage("Notifications live activées ✅");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button type="button" onClick={() => void subscribe()} disabled={loading} style={buttonStyle}>
        {loading ? "Activation..." : "Activer notifications live"}
      </button>
      {message ? <small style={{ color: "#15803d" }}>{message}</small> : null}
      {error ? <small style={{ color: "#b91c1c" }}>Erreur: {error}</small> : null}
    </div>
  );
}

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
