"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type CSSProperties } from "react";
import {
  clearStoredAppLogo,
  DEFAULT_APP_LOGO,
  readStoredAppLogo,
  writeStoredAppLogo,
} from "../components/app-logo";
import {
  DEFAULT_PROMO_CONFIG,
  evaluatePromo,
  readPromoConfig,
  resetPromoConfig,
  type CreatorPlan,
  type PromoConfig,
  writePromoConfig,
} from "../components/promo-config";

const MAX_LOGO_SIZE_MB = 3;
const MAX_LOGO_SIZE_BYTES = MAX_LOGO_SIZE_MB * 1024 * 1024;

export default function SettingsPage() {
  const [logoSrc, setLogoSrc] = useState(readStoredAppLogo);
  const [promoConfig, setPromoConfig] = useState<PromoConfig>(readPromoConfig);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setMessage(null);
    setError(null);

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (PNG, JPG, SVG, WebP…).");
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setError(`Le logo dépasse ${MAX_LOGO_SIZE_MB} MB.`);
      return;
    }

    try {
      const src = await fileToDataUrl(file);
      writeStoredAppLogo(src);
      setLogoSrc(src);
      setMessage("Logo mis à jour ✅");
    } catch {
      setError("Impossible de lire ce fichier.");
    }
  };

  const resetLogo = () => {
    clearStoredAppLogo();
    setLogoSrc(DEFAULT_APP_LOGO);
    setMessage("Logo réinitialisé.");
    setError(null);
  };

  const updatePromo = <K extends keyof PromoConfig>(key: K, value: PromoConfig[K]) => {
    setPromoConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updatePlan = (plan: CreatorPlan, checked: boolean) => {
    setPromoConfig((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [plan]: checked,
      },
    }));
  };

  const savePromo = () => {
    writePromoConfig(promoConfig);
    setMessage("Promotion admin enregistrée ✅");
    setError(null);
  };

  const resetPromo = () => {
    resetPromoConfig();
    setPromoConfig(DEFAULT_PROMO_CONFIG);
    setMessage("Promotion réinitialisée.");
    setError(null);
  };

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <Link href="/" style={backStyle}>
          ← Retour accueil
        </Link>

        <h1 style={{ margin: 0 }}>Paramètres de l’application</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Personnalisez votre logo d’application. Le nouveau logo s’affiche dans le bouton d’installation.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/settings/admin" style={previewBtnStyle}>
            Ouvrir dashboard administrateur
          </Link>
          <Link href="/settings/moderation" style={previewBtnStyle}>
            Ouvrir dashboard modération IA
          </Link>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ fontWeight: 600 }}>Logo actuel</label>
          <div style={previewWrapStyle}>
            <img src={logoSrc} alt="Logo application" style={previewImgStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label htmlFor="logoUpload" style={{ fontWeight: 600 }}>
            Importer un nouveau logo
          </label>
          <input id="logoUpload" type="file" accept="image/*" onChange={onFileChange} />
          <small style={{ color: "#6b7280" }}>Formats image acceptés, max {MAX_LOGO_SIZE_MB} MB.</small>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={resetLogo} style={resetBtnStyle}>
            Réinitialiser logo
          </button>
          <a href={logoSrc} target="_blank" rel="noreferrer" style={previewBtnStyle}>
            Ouvrir logo actuel
          </a>
        </div>

        {message ? <p style={{ color: "#15803d", margin: 0 }}>{message}</p> : null}
        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>Erreur: {error}</p> : null}

        <hr style={{ border: 0, borderTop: "1px solid #e2e8f0" }} />

        <h2 style={{ margin: 0 }}>Promotions admin (créateurs)</h2>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Activez des forfaits offerts ou des réductions temporaires, modulables selon le plan jour/semaine/mois.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={promoConfig.enabled}
            onChange={(e) => updatePromo("enabled", e.target.checked)}
          />
          Promotion active
        </label>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Type promo
            <select
              value={promoConfig.mode}
              onChange={(e) => updatePromo("mode", e.target.value as PromoConfig["mode"])}
              style={inputUiStyle}
            >
              <option value="discount">Réduction %</option>
              <option value="free">Forfait offert</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Réduction (%)
            <input
              type="number"
              min={1}
              max={100}
              value={promoConfig.discountPercent}
              onChange={(e) => updatePromo("discountPercent", Number(e.target.value || 0))}
              style={inputUiStyle}
              disabled={promoConfig.mode === "free"}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Début
            <input
              type="datetime-local"
              value={promoConfig.startAt}
              onChange={(e) => updatePromo("startAt", e.target.value)}
              style={inputUiStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
            Fin
            <input
              type="datetime-local"
              value={promoConfig.endAt}
              onChange={(e) => updatePromo("endAt", e.target.value)}
              style={inputUiStyle}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(["jour", "semaine", "mois"] as CreatorPlan[]).map((plan) => (
            <label key={plan} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={promoConfig.plans[plan]}
                onChange={(e) => updatePlan(plan, e.target.checked)}
              />
              Plan {plan}
            </label>
          ))}
        </div>

        <label style={{ display: "grid", gap: 6, fontWeight: 600 }}>
          Note promo (optionnel)
          <textarea
            value={promoConfig.note}
            onChange={(e) => updatePromo("note", e.target.value)}
            style={{ ...inputUiStyle, minHeight: 70, resize: "vertical" }}
            placeholder="Ex: Offre lancement 7 jours"
          />
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={savePromo} style={previewBtnStyle}>Enregistrer promo</button>
          <button onClick={resetPromo} style={resetBtnStyle}>Réinitialiser promo</button>
        </div>

        <div style={{ fontSize: 13, color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          Aperçu jour: {evaluatePromo(promoConfig, "jour").label}<br />
          Aperçu semaine: {evaluatePromo(promoConfig, "semaine").label}<br />
          Aperçu mois: {evaluatePromo(promoConfig, "mois").label}
        </div>
      </section>
    </main>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#eff6ff",
  padding: 24,
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: CSSProperties = {
  maxWidth: 700,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 20,
  display: "grid",
  gap: 14,
};

const backStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 700,
  textDecoration: "none",
};

const previewWrapStyle: CSSProperties = {
  width: 120,
  height: 120,
  borderRadius: 16,
  border: "1px solid #cbd5e1",
  display: "grid",
  placeItems: "center",
  background: "#f8fafc",
  overflow: "hidden",
};

const previewImgStyle: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
};

const resetBtnStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const previewBtnStyle: CSSProperties = {
  borderRadius: 10,
  padding: "10px 12px",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};

const inputUiStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
};
