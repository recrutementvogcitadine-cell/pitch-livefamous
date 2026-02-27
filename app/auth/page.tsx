"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  evaluatePromo,
  onPromoUpdated,
  readPromoConfig,
  type PromoConfig,
} from "../components/promo-config";

type AuthMode = "signin" | "signup" | "creator";
type CreatorPlan = "jour" | "semaine" | "mois";

type UserState = {
  email?: string;
  accountType?: string;
  creatorVerified?: boolean;
  creatorPlan?: string;
};

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creatorPlan, setCreatorPlan] = useState<CreatorPlan>("mois");
  const [creatorWhatsapp, setCreatorWhatsapp] = useState("");
  const [creatorInfo, setCreatorInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [promoConfig, setPromoConfig] = useState<PromoConfig>(readPromoConfig());

  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
  }, []);

  const promoInfo = promoInfoForPlan(promoConfig, creatorPlan);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    if (params.get("mode") === "creator") setMode("creator");
  }, []);

  useEffect(() => {
    setPromoConfig(readPromoConfig());
    return onPromoUpdated(() => setPromoConfig(readPromoConfig()));
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      if (!client) return;
      const { data } = await client.auth.getUser();
      const user = data.user;
      if (!user) {
        setUserState(null);
        return;
      }
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      setUserState({
        email: user.email,
        accountType: typeof meta.account_type === "string" ? meta.account_type : undefined,
        creatorVerified: Boolean(meta.creator_verified) || Boolean(meta.seller_active),
        creatorPlan: typeof meta.creator_plan === "string" ? meta.creator_plan : undefined,
      });
    };
    void loadUser();
  }, [client]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (!client) {
      setLoading(false);
      setError("Configuration Supabase manquante.");
      return;
    }

    if (mode !== "creator" && (!email || !password)) {
      setLoading(false);
      setError("Email et mot de passe requis.");
      return;
    }

    try {
      if (mode === "signin") {
        const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        const meta = (signInData.user?.user_metadata ?? {}) as Record<string, unknown>;
        const accountType = typeof meta.account_type === "string" ? meta.account_type : "spectator";
        if (accountType === "spectator") {
          window.location.href = "/watch";
          return;
        }
        window.location.href = "/lives";
        return;
      } else if (mode === "signup") {
        const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
        const { error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { account_type: "spectator", creator_verified: false },
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Inscription spectateur envoyée. Vérifiez votre email pour confirmer votre compte.");
      } else {
        if (!creatorWhatsapp.trim()) {
          throw new Error("Numéro WhatsApp requis pour le profil créateur.");
        }
        if (!creatorInfo.trim()) {
          throw new Error("Veuillez renseigner vos informations créateur pour la validation admin.");
        }

        const { data } = await client.auth.getUser();
        if (!data.user) {
          throw new Error("Connectez-vous d'abord pour demander le mode créateur.");
        }

        const { error: updateError } = await client.auth.updateUser({
          data: {
            account_type: "creator_pending",
            creator_verified: false,
            creator_plan: creatorPlan,
            creator_promo_applied: promoInfo.active,
            creator_promo_mode: promoInfo.active ? promoInfo.mode : null,
            creator_promo_discount_percent: promoInfo.discountPercent ?? null,
            creator_promo_label: promoInfo.label,
            creator_whatsapp: creatorWhatsapp.trim(),
            creator_profile_info: creatorInfo.trim(),
            creator_request_status: "pending_admin",
            creator_request_channel: "whatsapp",
          },
        });
        if (updateError) throw updateError;

        setMessage(
          "Demande créateur envoyée. Contactez-nous sur WhatsApp avec vos documents. Un admin activera votre accès live après validation."
        );
        setUserState({
          email: data.user.email,
          accountType: "creator_pending",
          creatorVerified: false,
          creatorPlan,
        });
      }
    } catch (err: unknown) {
      setError(toAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#eff6ff", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <section
        style={{
          maxWidth: 480,
          margin: "24px auto",
          background: "#fff",
          border: "1px solid #dbeafe",
          borderRadius: 14,
          padding: 20,
          display: "grid",
          gap: 14,
        }}
      >
        <Link href="/" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>
          ← Retour accueil
        </Link>

        <h1 style={{ margin: 0 }}>Accès public</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Tous les utilisateurs peuvent s&apos;inscrire comme spectateurs. Pour activer la caméra, faites une demande créateur
          (forfait jour/semaine/mois) puis validation admin.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button
            type="button"
            onClick={() => setMode("signin")}
            style={{
              ...tabStyle,
              background: mode === "signin" ? "#1d4ed8" : "#e5edff",
              color: mode === "signin" ? "#fff" : "#1e3a8a",
            }}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            style={{
              ...tabStyle,
              background: mode === "signup" ? "#1d4ed8" : "#e5edff",
              color: mode === "signup" ? "#fff" : "#1e3a8a",
            }}
          >
            Inscription
          </button>
        </div>

        {mode === "creator" ? (
          <div style={{ fontSize: 13, color: "#1e3a8a", background: "#e0edff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 10 }}>
            Demande créateur déclenchée depuis le bouton “Passer en live”.
          </div>
        ) : null}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>
            Email
            <input
              type="email"
              required={mode !== "creator"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="vous@exemple.com"
            />
          </label>

          <label style={labelStyle}>
            Mot de passe
            <input
              type="password"
              required={mode !== "creator"}
              minLength={mode !== "creator" ? 6 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </label>

          {mode === "creator" ? (
            <>
              <label style={labelStyle}>
                Forfait souhaité
                <select value={creatorPlan} onChange={(e) => setCreatorPlan(e.target.value as CreatorPlan)} style={inputStyle}>
                  <option value="jour">Jour</option>
                  <option value="semaine">Semaine</option>
                  <option value="mois">Mois</option>
                </select>
              </label>

              <label style={labelStyle}>
                WhatsApp
                <input
                  required
                  value={creatorWhatsapp}
                  onChange={(e) => setCreatorWhatsapp(e.target.value)}
                  style={inputStyle}
                  placeholder="Ex: +2250700000000"
                />
              </label>

              <label style={labelStyle}>
                Informations / documents
                <textarea
                  required
                  value={creatorInfo}
                  onChange={(e) => setCreatorInfo(e.target.value)}
                  style={{ ...inputStyle, minHeight: 88, resize: "vertical" }}
                  placeholder="Nom, activité, pièce d'identité, lien boutique, etc."
                />
              </label>
            </>
          ) : null}

          {mode === "creator" ? (
            <div style={{ fontSize: 13, color: "#334155", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              Promo actuelle pour ce forfait: <strong>{promoInfo.label}</strong>
              {promoInfo.note ? <div style={{ marginTop: 4 }}>Note admin: {promoInfo.note}</div> : null}
            </div>
          ) : null}

          <button type="submit" disabled={loading} style={submitStyle}>
            {loading
              ? "Traitement..."
              : mode === "signin"
                ? "Se connecter"
                : mode === "signup"
                  ? "Créer mon compte spectateur"
                  : "Envoyer ma demande créateur"}
          </button>
        </form>

        {mode === "creator" ? (
          <div style={{ fontSize: 13, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
            Aucun paiement sur l&apos;application. Après la demande, contactez l&apos;équipe sur WhatsApp pour envoyer les documents.
            Un admin validera votre compte avant activation live caméra.
          </div>
        ) : null}

        {userState ? (
          <div style={{ padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 700 }}>Session actuelle</div>
            <div style={{ fontSize: 14 }}>Email: {userState.email ?? "-"}</div>
            <div style={{ fontSize: 14 }}>Type de compte: {userState.accountType ?? "spectator"}</div>
            <div style={{ fontSize: 14 }}>
              Live caméra: {userState.creatorVerified ? "activé ✅" : "en attente validation admin"}
            </div>
            <div style={{ fontSize: 14 }}>
              Badge certifié: {userState.creatorVerified ? <span style={{ color: "#2563eb", fontWeight: 700 }}>✔ bleu</span> : "non"}
            </div>
            {userState.creatorPlan ? <div style={{ fontSize: 14 }}>Forfait demandé: {userState.creatorPlan}</div> : null}
          </div>
        ) : (
          <p style={{ margin: 0, color: "#64748b" }}>Non connecté. Connectez-vous pour envoyer une demande créateur.</p>
        )}

        {message ? <p style={{ color: "#15803d", margin: 0 }}>{message}</p> : null}
        {error ? <p style={{ color: "#b91c1c", margin: 0 }}>Erreur: {error}</p> : null}
      </section>
    </main>
  );
}

function promoInfoForPlan(config: PromoConfig, plan: CreatorPlan) {
  return evaluatePromo(config, plan);
}

function toAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return normalizeAuthErrorMessage(err.message);
  }

  if (typeof err === "string") {
    return normalizeAuthErrorMessage(err);
  }

  if (err && typeof err === "object") {
    const maybeMessage = Reflect.get(err, "message");
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return normalizeAuthErrorMessage(maybeMessage);
    }

    const maybeErrorDescription = Reflect.get(err, "error_description");
    if (typeof maybeErrorDescription === "string" && maybeErrorDescription.trim().length > 0) {
      return normalizeAuthErrorMessage(maybeErrorDescription);
    }

    const maybeError = Reflect.get(err, "error");
    if (typeof maybeError === "string" && maybeError.trim().length > 0) {
      return normalizeAuthErrorMessage(maybeError);
    }
  }

  return "Erreur de connexion. Vérifiez vos informations puis réessayez.";
}

function normalizeAuthErrorMessage(raw: string): string {
  const value = raw.trim();
  const lower = value.toLowerCase();

  if (lower.includes("email signups are disabled")) {
    return "Les inscriptions email sont désactivées. Activez Email provider dans Supabase Auth > Providers.";
  }

  if (lower.includes("user already registered")) {
    return "Cet email existe déjà. Connectez-vous ou utilisez “mot de passe oublié” dans Supabase.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email ou mot de passe invalide. Réessayez ou faites une réinitialisation du mot de passe.";
  }

  if (lower.includes("email not confirmed") || lower.includes("signup requires email verification")) {
    return "Email non confirmé. Vérifiez votre boîte mail ou désactivez temporairement la confirmation dans Supabase pour les tests.";
  }

  if (value === "[object Object]") {
    return "Erreur d'authentification non lisible. Vérifiez la configuration Supabase et réessayez.";
  }

  return value;
}

const tabStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  cursor: "pointer",
  flex: 1,
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#1f2937",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
};

const submitStyle: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "11px 14px",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};
