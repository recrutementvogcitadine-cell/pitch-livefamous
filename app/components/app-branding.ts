"use client";

import { useEffect, useState } from "react";

export type AppBranding = {
  appName: string;
  welcomeMessage: string;
  logoSrc: string;
};

export const DEFAULT_BRANDING: AppBranding = {
  appName: "Pitch Live",
  welcomeMessage: "Bienvenue sur Pitch Live — découvrez les lives en cours et connectez-vous en temps réel.",
  logoSrc: "/famous-ai-logo.svg",
};

export function useAppBranding() {
  const [branding, setBranding] = useState<AppBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/ui/branding", { cache: "no-store" });
        if (!response.ok) return;

        const body = (await response.json()) as Partial<AppBranding>;
        setBranding((prev) => ({
          appName: typeof body.appName === "string" && body.appName.trim() ? body.appName : prev.appName,
          welcomeMessage:
            typeof body.welcomeMessage === "string" && body.welcomeMessage.trim() ? body.welcomeMessage : prev.welcomeMessage,
          logoSrc: typeof body.logoSrc === "string" && body.logoSrc.trim() ? body.logoSrc : prev.logoSrc,
        }));
      } catch {}
    };

    void load();
  }, []);

  return branding;
}
