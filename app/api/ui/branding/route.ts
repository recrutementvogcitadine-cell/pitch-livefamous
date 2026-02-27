import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BRANDING = {
  appName: "Pitch Live",
  welcomeMessage: "Bienvenue sur Pitch Live — découvrez les lives en cours et connectez-vous en temps réel.",
  logoSrc: "/famous-ai-logo.svg",
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeText(value: unknown, fallback: string, max = 200) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

export async function GET() {
  try {
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(DEFAULT_BRANDING, { status: 200 });
    }

    const { data, error } = await adminClient
      .from("app_branding_settings")
      .select("app_name,welcome_message,logo_src")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(DEFAULT_BRANDING, { status: 200 });
    }

    return NextResponse.json(
      {
        appName: normalizeText(data?.app_name, DEFAULT_BRANDING.appName, 80),
        welcomeMessage: normalizeText(data?.welcome_message, DEFAULT_BRANDING.welcomeMessage, 220),
        logoSrc: normalizeText(data?.logo_src, DEFAULT_BRANDING.logoSrc, 2000),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(DEFAULT_BRANDING, { status: 200 });
  }
}
