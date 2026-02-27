import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type AppRole = "super_admin" | "admin" | "agent";

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

  return { ok: true as const, user, currentRole, adminClient };
}

export async function GET() {
  try {
    const auth = await requireRoleManager();
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users = (data.users ?? []).map((item) => {
      const userMeta = (item.user_metadata ?? {}) as Record<string, unknown>;
      const roleFromMeta = parseRole(userMeta.app_role);
      const role = isBootstrapSuperAdmin(item.email) ? "super_admin" : roleFromMeta;

      return {
        id: item.id,
        email: item.email,
        role,
      };
    });

    return NextResponse.json(
      {
        currentUser: {
          id: auth.user.id,
          email: auth.user.email,
          role: auth.currentRole,
        },
        users,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "roles get failed", detail: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRoleManager();
    if (!auth.ok) return auth.response;

    const payload = (await req.json()) as { userId?: string; role?: AppRole };
    const userId = payload.userId?.trim();
    const role = parseRole(payload.role);

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    if (role === "super_admin" && auth.currentRole !== "super_admin") {
      return NextResponse.json({ error: "only super_admin can assign super_admin" }, { status: 403 });
    }

    const { data: targetData, error: targetError } = await auth.adminClient.auth.admin.getUserById(userId);
    if (targetError || !targetData.user) {
      return NextResponse.json({ error: targetError?.message ?? "target user not found" }, { status: 404 });
    }

    const nextMeta = {
      ...((targetData.user.user_metadata ?? {}) as Record<string, unknown>),
      app_role: role,
    };

    const { error: updateError } = await auth.adminClient.auth.admin.updateUserById(userId, {
      user_metadata: nextMeta,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: "roles patch failed", detail: String(error) }, { status: 500 });
  }
}
