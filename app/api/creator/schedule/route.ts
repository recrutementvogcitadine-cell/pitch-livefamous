import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return null;

  return createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireUser() {
  const serverClient = await createServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false as const, response: NextResponse.json({ error: "service role missing" }, { status: 503 }) };
  }

  return { ok: true as const, user, admin };
}

function normalizeText(value: unknown, max = 140) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.admin
      .from("creator_live_schedule")
      .select("next_live_at,announcement")
      .eq("creator_user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        creatorId: auth.user.id,
        nextLiveAt: data?.next_live_at ?? null,
        announcement: data?.announcement ?? "",
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "creator schedule get failed", detail: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const payload = (await req.json()) as { nextLiveAt?: string | null; announcement?: string };
    const announcement = normalizeText(payload.announcement, 180);
    const nextLiveAt = typeof payload.nextLiveAt === "string" && payload.nextLiveAt.trim() ? payload.nextLiveAt : null;

    const { error } = await auth.admin.from("creator_live_schedule").upsert(
      {
        creator_user_id: auth.user.id,
        next_live_at: nextLiveAt,
        announcement,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_user_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, creatorId: auth.user.id, nextLiveAt, announcement }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: "creator schedule patch failed", detail: String(error) }, { status: 500 });
  }
}
