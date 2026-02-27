"use client";

export type CreatorPlan = "jour" | "semaine" | "mois";
export type PromoMode = "free" | "discount";

export type PromoConfig = {
  enabled: boolean;
  mode: PromoMode;
  discountPercent: number;
  startAt: string;
  endAt: string;
  note: string;
  plans: Record<CreatorPlan, boolean>;
};

export type PromoEvaluation = {
  active: boolean;
  mode: PromoMode;
  label: string;
  discountPercent?: number;
  note?: string;
};

export const PROMO_STORAGE_KEY = "famous_ai_creator_promo";
const PROMO_UPDATED_EVENT = "famous-ai-promo-updated";

export const DEFAULT_PROMO_CONFIG: PromoConfig = {
  enabled: false,
  mode: "discount",
  discountPercent: 20,
  startAt: "",
  endAt: "",
  note: "",
  plans: {
    jour: true,
    semaine: true,
    mois: true,
  },
};

export function readPromoConfig(): PromoConfig {
  if (typeof window === "undefined") return DEFAULT_PROMO_CONFIG;
  const raw = window.localStorage.getItem(PROMO_STORAGE_KEY);
  if (!raw) return DEFAULT_PROMO_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<PromoConfig>;
    return {
      ...DEFAULT_PROMO_CONFIG,
      ...parsed,
      plans: {
        ...DEFAULT_PROMO_CONFIG.plans,
        ...(parsed.plans ?? {}),
      },
      discountPercent: Number.isFinite(Number(parsed.discountPercent)) ? Number(parsed.discountPercent) : DEFAULT_PROMO_CONFIG.discountPercent,
    };
  } catch {
    return DEFAULT_PROMO_CONFIG;
  }
}

export function writePromoConfig(config: PromoConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(PROMO_UPDATED_EVENT));
}

export function resetPromoConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROMO_STORAGE_KEY);
  window.dispatchEvent(new Event(PROMO_UPDATED_EVENT));
}

export function onPromoUpdated(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROMO_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PROMO_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROMO_UPDATED_EVENT, listener);
  };
}

export function evaluatePromo(config: PromoConfig, plan: CreatorPlan): PromoEvaluation {
  if (!config.enabled) {
    return { active: false, mode: config.mode, label: "Aucune promo" };
  }

  if (!config.plans[plan]) {
    return { active: false, mode: config.mode, label: "Aucune promo sur ce forfait" };
  }

  const now = Date.now();
  const start = config.startAt ? new Date(config.startAt).getTime() : null;
  const end = config.endAt ? new Date(config.endAt).getTime() : null;

  if (start && now < start) {
    return { active: false, mode: config.mode, label: "Promo pas encore active" };
  }
  if (end && now > end) {
    return { active: false, mode: config.mode, label: "Promo expirée" };
  }

  if (config.mode === "free") {
    return { active: true, mode: "free", label: "Forfait offert (promo)", note: config.note || undefined };
  }

  const percent = Math.max(1, Math.min(100, Math.round(config.discountPercent || 0)));
  return {
    active: true,
    mode: "discount",
    label: `Réduction temporaire ${percent}%`,
    discountPercent: percent,
    note: config.note || undefined,
  };
}
