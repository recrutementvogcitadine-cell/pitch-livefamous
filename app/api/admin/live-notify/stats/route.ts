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

  return { ok: true as const, adminClient };
}

export async function GET() {
  try {
    const auth = await requireRoleManager();
    if (!auth.ok) return auth.response;

    const [followersRes, subscriptionsRes, eventsRes, liveCreatorsRes] = await Promise.all([
      auth.adminClient.from("live_creator_followers").select("creator_user_id,follower_user_id", { count: "exact" }),
      auth.adminClient.from("live_push_subscriptions").select("user_id", { count: "exact" }),
      auth.adminClient
        .from("live_notification_events")
        .select("sent_count,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(1000),
      auth.adminClient.from("lives").select("id", { count: "exact", head: true }).eq("status", "live"),
    ]);

    if (followersRes.error) return NextResponse.json({ error: followersRes.error.message }, { status: 500 });
    if (subscriptionsRes.error) return NextResponse.json({ error: subscriptionsRes.error.message }, { status: 500 });
  if (liveCreatorsRes.error) return NextResponse.json({ error: liveCreatorsRes.error.message }, { status: 500 });

    const followersRows = followersRes.data ?? [];
    const subscriptionsRows = subscriptionsRes.data ?? [];

    const creatorIds = new Set<string>();
    const followerIds = new Set<string>();
    for (const row of followersRows) {
      if (row.creator_user_id) creatorIds.add(String(row.creator_user_id));
      if (row.follower_user_id) followerIds.add(String(row.follower_user_id));
    }

    const eventsRows = eventsRes.error ? [] : eventsRes.data ?? [];
    const notificationsSentTotal = eventsRows.reduce((sum, row) => sum + Number(row.sent_count ?? 0), 0);
    const notificationsEvents = eventsRes.error ? 0 : eventsRes.count ?? 0;
    const lastSentAt = eventsRows.length > 0 ? (eventsRows[0].created_at as string) : null;

    return NextResponse.json(
      {
        followersLinks: followersRes.count ?? followersRows.length,
        creatorsFollowed: creatorIds.size,
        uniqueFollowers: followerIds.size,
        pushSubscriptions: subscriptionsRes.count ?? subscriptionsRows.length,
        notificationsSentTotal,
        notificationsEvents,
        lastSentAt,
        eventsTableMissing: Boolean(eventsRes.error),
        liveCreatorsNow: liveCreatorsRes.count ?? 0,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "live notify stats failed", detail: String(error) }, { status: 500 });
  }
}
