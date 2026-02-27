import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type EscalationStatus = "open" | "resolved";

type EscalationRow = {
  id: string;
  live_id: string;
  user_id: string;
  question: string;
  reason: string;
  status?: EscalationStatus;
  resolution_note?: string | null;
  resolved_by?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

function isModeratorEmail(email: string | undefined) {
  const raw = process.env.LIVE_AI_MODERATOR_EMAILS ?? "";
  const list = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!list.length) return true;
  return Boolean(email && list.includes(email.toLowerCase()));
}

function createAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !serviceRole) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function requireModerator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  if (!isModeratorEmail(user.email)) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  const adminSupabase = createAdminSupabase();
  if (!adminSupabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE missing for moderation API" },
        { status: 503 }
      ),
    };
  }

  return { ok: true as const, user, adminSupabase };
}

export async function GET(req: Request) {
  try {
    const auth = await requireModerator();
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") ?? "open").toLowerCase();
    const status: EscalationStatus = statusParam === "resolved" ? "resolved" : "open";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

    const { data, error } = await auth.adminSupabase
      .from("live_ai_escalations")
      .select("id,live_id,user_id,question,reason,status,resolution_note,resolved_by,created_at,resolved_at")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const lowered = error.message.toLowerCase();
      if (lowered.includes("does not exist")) {
        return NextResponse.json({ escalations: [] }, { status: 200 });
      }
      return NextResponse.json({ error: "fetch escalations failed" }, { status: 500 });
    }

    return NextResponse.json({ escalations: (data ?? []) as EscalationRow[] }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "moderation get failed", detail: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireModerator();
    if (!auth.ok) return auth.response;

    const payload = (await req.json()) as {
      id?: string;
      status?: EscalationStatus;
      resolutionNote?: string;
    };

    const escalationId = payload.id?.trim();
    const status = payload.status === "resolved" ? "resolved" : "open";

    if (!escalationId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updatePayload = {
      status,
      resolution_note: payload.resolutionNote?.trim() || null,
      resolved_by: status === "resolved" ? auth.user.id : null,
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    };

    const { error } = await auth.adminSupabase
      .from("live_ai_escalations")
      .update(updatePayload)
      .eq("id", escalationId);

    if (error) {
      return NextResponse.json({ error: "update escalation failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: "moderation patch failed", detail: String(error) },
      { status: 500 }
    );
  }
}
