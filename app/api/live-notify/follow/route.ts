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

async function requireUser(req: Request) {
  const serverClient = await createServerClient();
  const {
    data: { user: cookieUser },
  } = await serverClient.auth.getUser();

  let user = cookieUser;

  if (!user) {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

    if (bearerToken) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && anonKey) {
        const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const {
          data: { user: bearerUser },
        } = await anonClient.auth.getUser(bearerToken);

        if (bearerUser) user = bearerUser;
      }
    }
  }

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE missing" }, { status: 503 }),
    };
  }

  return { ok: true as const, user, admin };
}

export async function GET(req: Request) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const creators = (url.searchParams.get("creators") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    let query = auth.admin
      .from("live_creator_followers")
      .select("creator_user_id")
      .eq("follower_user_id", auth.user.id);

    if (creators.length > 0) {
      query = query.in("creator_user_id", creators);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        followedCreatorIds: (data ?? []).map((row) => row.creator_user_id as string),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "follow get failed", detail: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const payload = (await req.json()) as { creatorId?: string; follow?: boolean };
    const creatorId = payload.creatorId?.trim();
    const shouldFollow = payload.follow !== false;

    if (!creatorId) {
      return NextResponse.json({ error: "creatorId required" }, { status: 400 });
    }

    if (creatorId === auth.user.id) {
      return NextResponse.json({ error: "cannot follow yourself" }, { status: 400 });
    }

    if (shouldFollow) {
      const { error } = await auth.admin.from("live_creator_followers").upsert(
        {
          creator_user_id: creatorId,
          follower_user_id: auth.user.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "creator_user_id,follower_user_id" }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await auth.admin
        .from("live_creator_followers")
        .delete()
        .eq("creator_user_id", creatorId)
        .eq("follower_user_id", auth.user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, following: shouldFollow }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: "follow post failed", detail: String(error) }, { status: 500 });
  }
}
