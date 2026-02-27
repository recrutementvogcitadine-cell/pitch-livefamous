import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type AppRole = "super_admin" | "admin" | "agent";

const ALLOWED_ROLES: AppRole[] = ["super_admin", "admin", "agent"];

const DEFAULT_BRANDING = {
  appName: "Pitch Live",
  welcomeMessage: "Bienvenue sur Pitch Live — découvrez les lives en cours et connectez-vous en temps réel.",
  logoSrc: "/famous-ai-logo.svg",
};

function parseRole(value: unknown): AppRole {
  if (typeof value !== "string") return "agent";
  return ALLOWED_ROLES.includes(value as AppRole) ? (value as AppRole) : "agent";
}

function parseEmailSet(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isBootstrapSuperAdmin(email: string | undefined) {
  const superAdmins = parseEmailSet(process.env.SUPER_ADMIN_EMAILS);
  if (!superAdmins.size) return false;
  return Boolean(email && superAdmins.has(email.toLowerCase()));
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireRoleManager() {
  const serverClient = await createServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const roleFromMeta = parseRole(meta.app_role);
  const currentRole = isBootstrapSuperAdmin(user.email) ? "super_admin" : roleFromMeta;

  if (currentRole !== "super_admin" && currentRole !== "admin") {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE missing" }, { status: 503 }),
    };
  }

  return { ok: true as const, currentRole, adminClient };
}

function normalizeText(value: unknown, fallback: string, max = 200) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

export async function GET() {
  try {
    const auth = await requireRoleManager();
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.adminClient
      .from("app_branding_settings")
      .select("app_name,welcome_message,logo_src")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        appName: normalizeText(data?.app_name, DEFAULT_BRANDING.appName, 80),
        welcomeMessage: normalizeText(data?.welcome_message, DEFAULT_BRANDING.welcomeMessage, 220),
        logoSrc: normalizeText(data?.logo_src, DEFAULT_BRANDING.logoSrc, 2000),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "branding get failed", detail: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRoleManager();
    if (!auth.ok) return auth.response;

    const payload = (await req.json()) as { appName?: string; welcomeMessage?: string; logoSrc?: string };

    const appName = normalizeText(payload.appName, DEFAULT_BRANDING.appName, 80);
    const welcomeMessage = normalizeText(payload.welcomeMessage, DEFAULT_BRANDING.welcomeMessage, 220);
    const logoSrc = normalizeText(payload.logoSrc, DEFAULT_BRANDING.logoSrc, 2000);

    const { error } = await auth.adminClient.from("app_branding_settings").upsert(
      {
        id: 1,
        app_name: appName,
        welcome_message: welcomeMessage,
        logo_src: logoSrc,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, appName, welcomeMessage, logoSrc }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: "branding patch failed", detail: String(error) }, { status: 500 });
  }
}
