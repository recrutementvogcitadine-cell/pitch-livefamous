import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return null;

  return createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "service role missing" }, { status: 503 });
    }

    const url = new URL(req.url);
    const creatorId = (url.searchParams.get("creatorId") ?? "").trim();
    if (!creatorId) {
      return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    }

    const [liveRes, historyRes, scheduleRes] = await Promise.all([
      admin
        .from("lives")
        .select("id,title,status,created_at,creator_id")
        .eq("creator_id", creatorId)
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(1),
      admin
        .from("lives")
        .select("id,title,status,created_at,creator_id")
        .eq("creator_id", creatorId)
        .neq("status", "live")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("creator_live_schedule")
        .select("next_live_at,announcement")
        .eq("creator_user_id", creatorId)
        .maybeSingle(),
    ]);

    if (liveRes.error) return NextResponse.json({ error: liveRes.error.message }, { status: 500 });
    if (historyRes.error) return NextResponse.json({ error: historyRes.error.message }, { status: 500 });
    if (scheduleRes.error) return NextResponse.json({ error: scheduleRes.error.message }, { status: 500 });

    return NextResponse.json(
      {
        creatorId,
        currentLive: (liveRes.data ?? [])[0] ?? null,
        oldLives: historyRes.data ?? [],
        nextLiveAt: scheduleRes.data?.next_live_at ?? null,
        announcement: scheduleRes.data?.announcement ?? "",
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "creator profile failed", detail: String(error) }, { status: 500 });
  }
}
