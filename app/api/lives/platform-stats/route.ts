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

export async function GET() {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          creators: 0,
          replays: 0,
          liveNow: 0,
          source: "disconnected",
        },
        { status: 200 }
      );
    }

    const [creatorProfilesRes, replaysRes, liveNowRes] = await Promise.all([
      admin
        .from("creator_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("is_validated", true),
      admin
        .from("live_streams")
        .select("id", { count: "exact", head: true })
        .in("status", ["ended", "completed"]),
      admin
        .from("live_streams")
        .select("id", { count: "exact", head: true })
        .in("status", ["live", "active"]),
    ]);

    let source: "connected" | "degraded" = "connected";

    const creators = creatorProfilesRes.error ? 0 : creatorProfilesRes.count ?? 0;
    const replays = replaysRes.error ? 0 : replaysRes.count ?? 0;
    let liveNow = liveNowRes.error ? 0 : liveNowRes.count ?? 0;

    if (liveNowRes.error) {
      const fallbackLiveNow = await admin
        .from("lives")
        .select("id", { count: "exact", head: true })
        .in("status", ["live", "active"]);

      if (!fallbackLiveNow.error) {
        liveNow = fallbackLiveNow.count ?? 0;
      }
    }

    if (creatorProfilesRes.error || replaysRes.error || liveNowRes.error) {
      source = "degraded";
    }

    return NextResponse.json(
      {
        creators,
        replays,
        liveNow,
        source,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      {
        creators: 0,
        replays: 0,
        liveNow: 0,
        source: "disconnected",
      },
      { status: 200 }
    );
  }
}
