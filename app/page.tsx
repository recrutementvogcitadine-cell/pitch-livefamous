"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createClient } from "@supabase/supabase-js";
import AddToHomeButton from "./components/AddToHomeButton";
import { useAppLogo } from "./components/app-logo";

export default function Home() {
  const appLogo = useAppLogo();

  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  useEffect(() => {
    const redirectSpectator = async () => {
      if (!client) return;
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user) return;

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const accountType = typeof meta.account_type === "string" ? meta.account_type : "spectator";
      if (accountType === "spectator") {
        window.location.href = "/watch";
      }
    };
    void redirectSpectator();
  }, [client]);

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 1100,
        margin: "0 auto",
        display: "grid",
        gap: 20,
        background: "linear-gradient(180deg, #eff6ff 0%, #ffffff 45%)",
        minHeight: "100vh",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={appLogo}
            alt="Logo Famous AI"
            width={46}
            height={46}
            style={{ borderRadius: 10, objectFit: "cover", border: "1px solid #bfdbfe", background: "#fff" }}
          />
          <div>
            <h1 style={{ fontSize: 30, margin: 0 }}>Famous AI</h1>
            <p style={{ margin: "8px 0 0", color: "#4b5563" }}>
              Plateforme live interactive: diffusion vidéo, données temps réel et expérience mobile.
            </p>
          </div>
        </div>
        <AddToHomeButton />
      </header>

      <section
        style={{
          border: "1px solid #bfdbfe",
          borderRadius: 12,
          padding: 18,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          background: "#ffffff",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Démarrer rapidement</h2>
          <p style={{ margin: 0, color: "#4b5563" }}>
            Inscrivez-vous ou connectez-vous pour accéder au flux live. Le mode créateur se déclenche uniquement quand
            vous voulez passer en live.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/auth" style={{ ...actionBtnStyle, background: "#0f172a" }}>
            Connexion
          </Link>
          <Link href="/auth?mode=signup" style={{ ...actionBtnStyle, background: "#1d4ed8" }}>
            Inscription
          </Link>
        </div>
      </section>
    </main>
  );
}

const actionBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
};
