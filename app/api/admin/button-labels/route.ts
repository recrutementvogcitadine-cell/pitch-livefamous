import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type AppRole = "super_admin" | "admin" | "agent";

const DEFAULT_BUTTON_LABELS = {
  goLiveLabel: "Passer en live caméra",
  goLiveCreatorLabel: "Passer en live (créateur)",
  becomeCreatorLabel: "Devenir créateur",
  allowAgentEdit: false,
};

const ALLOWED_ROLES: AppRole[] = ["super_admin", "admin", "agent"];

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
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireLoggedUser() {
  const serverClient = await createServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE missing" }, { status: 503 }),
    };
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const roleFromMeta = parseRole(meta.app_role);
  const currentRole = isBootstrapSuperAdmin(user.email) ? "super_admin" : roleFromMeta;

  return { ok: true as const, user, currentRole, adminClient };
}

async function readSettings(adminClient: ReturnType<typeof createAdminClient>) {
  const { data, error } = await adminClient!
    .from("app_button_labels")
    .select("go_live_label,go_live_creator_label,become_creator_label,allow_agent_edit")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return { error };
  }

  return {
    value: {
      goLiveLabel: typeof data?.go_live_label === "string" && data.go_live_label.trim() ? data.go_live_label : DEFAULT_BUTTON_LABELS.goLiveLabel,
      goLiveCreatorLabel:
        typeof data?.go_live_creator_label === "string" && data.go_live_creator_label.trim()
          ? data.go_live_creator_label
          : DEFAULT_BUTTON_LABELS.goLiveCreatorLabel,
      becomeCreatorLabel:
        typeof data?.become_creator_label === "string" && data.become_creator_label.trim()
          ? data.become_creator_label
          : DEFAULT_BUTTON_LABELS.becomeCreatorLabel,
      allowAgentEdit: Boolean(data?.allow_agent_edit),
    },
  };
}

function normalizeLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 80);
}

export async function GET() {
  try {
    const auth = await requireLoggedUser();
    if (!auth.ok) return auth.response;

    const settingsRes = await readSettings(auth.adminClient);
    if (settingsRes.error) {
      return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...settingsRes.value,
        currentRole: auth.currentRole,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "button labels get failed", detail: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireLoggedUser();
    if (!auth.ok) return auth.response;

    const settingsRes = await readSettings(auth.adminClient);
    if (settingsRes.error) {
      return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
    }

    const currentSettings = settingsRes.value;
    const isRoleAllowed =
      auth.currentRole === "super_admin" || auth.currentRole === "admin" || (auth.currentRole === "agent" && currentSettings.allowAgentEdit);

    if (!isRoleAllowed) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const payload = (await req.json()) as {
      goLiveLabel?: string;
      goLiveCreatorLabel?: string;
      becomeCreatorLabel?: string;
      allowAgentEdit?: boolean;
    };

    const nextAllowAgentEdit =
      typeof payload.allowAgentEdit === "boolean"
        ? auth.currentRole === "super_admin"
          ? payload.allowAgentEdit
          : currentSettings.allowAgentEdit
        : currentSettings.allowAgentEdit;

    if (typeof payload.allowAgentEdit === "boolean" && auth.currentRole !== "super_admin") {
      return NextResponse.json({ error: "only super_admin can change agent permission" }, { status: 403 });
    }

    const nextValue = {
      id: 1,
      go_live_label: normalizeLabel(payload.goLiveLabel, currentSettings.goLiveLabel),
      go_live_creator_label: normalizeLabel(payload.goLiveCreatorLabel, currentSettings.goLiveCreatorLabel),
      become_creator_label: normalizeLabel(payload.becomeCreatorLabel, currentSettings.becomeCreatorLabel),
      allow_agent_edit: nextAllowAgentEdit,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await auth.adminClient.from("app_button_labels").upsert(nextValue, { onConflict: "id" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        goLiveLabel: nextValue.go_live_label,
        goLiveCreatorLabel: nextValue.go_live_creator_label,
        becomeCreatorLabel: nextValue.become_creator_label,
        allowAgentEdit: nextValue.allow_agent_edit,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "button labels patch failed", detail: String(error) }, { status: 500 });
  }
}
