"use client";
import { useEffect, useState } from "react";
import { useAppLogo } from "./app-logo";

export default function AddToHomeButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const appLogo = useAppLogo();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClick = async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
      };

      await promptEvent.prompt();
      try {
        await promptEvent.userChoice;
      } catch {
        // ignore
      }
      setDeferredPrompt(null);
    } else {
      alert("Sur iOS Safari : appuyez sur le bouton Partager puis 'Ajouter à l'écran d'accueil'.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
      <button
        onClick={onClick}
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "#0b61ff",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 600,
        }}
      >
        <img
          src={appLogo}
          alt="Logo Famous AI"
          width={22}
          height={22}
          style={{ borderRadius: 6, background: "#fff", padding: 2 }}
        />
        Installer l&apos;app
      </button>
      <small style={{ color: "#666", fontSize: 12 }}>
        Sur iOS : Partager → Ajouter à l&apos;écran d&apos;accueil
      </small>
    </div>
  );
}

