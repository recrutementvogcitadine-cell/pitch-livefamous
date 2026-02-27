"use client";

import { useEffect, useState } from "react";

export const APP_LOGO_STORAGE_KEY = "famous_ai_logo_src";
export const DEFAULT_APP_LOGO = "/famous-ai-logo.svg";
const APP_LOGO_UPDATED_EVENT = "famous-ai-logo-updated";

export function readStoredAppLogo() {
  if (typeof window === "undefined") return DEFAULT_APP_LOGO;
  const value = window.localStorage.getItem(APP_LOGO_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : DEFAULT_APP_LOGO;
}

export function writeStoredAppLogo(src: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_LOGO_STORAGE_KEY, src);
  window.dispatchEvent(new Event(APP_LOGO_UPDATED_EVENT));
}

export function clearStoredAppLogo() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(APP_LOGO_STORAGE_KEY);
  window.dispatchEvent(new Event(APP_LOGO_UPDATED_EVENT));
}

export function useAppLogo() {
  const [logoSrc, setLogoSrc] = useState(readStoredAppLogo);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === APP_LOGO_STORAGE_KEY) {
        setLogoSrc(readStoredAppLogo());
      }
    };

    const onUpdate = () => setLogoSrc(readStoredAppLogo());

    window.addEventListener("storage", onStorage);
    window.addEventListener(APP_LOGO_UPDATED_EVENT, onUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APP_LOGO_UPDATED_EVENT, onUpdate);
    };
  }, []);

  return logoSrc;
}
