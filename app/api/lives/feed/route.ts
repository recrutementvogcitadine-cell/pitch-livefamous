import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  creator_id: string | null;
};

function normalizeWhatsapp(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 30);
}

async function getAuthenticatedUser(req: Request) {
  const userClient = await createUserClient();
  const {
    data: { user: cookieUser },
  } = await userClient.auth.getUser();

  if (cookieUser) {
    return { user: cookieUser, error: null as string | null };
  }

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";

  if (!bearerToken) {
    return { user: null, error: "unauthorized" };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { user: null, error: "supabase anon env missing" };
  }

  const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: bearerUser },
  } = await anonClient.auth.getUser(bearerToken);

  if (!bearerUser) {
    return { user: null, error: "unauthorized" };
  }

  return { user: bearerUser, error: null as string | null };
}

export async function GET(req: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(req);

    if (!user) {
      const status = authError === "supabase anon env missing" ? 500 : 401;
      return NextResponse.json({ error: authError ?? "unauthorized" }, { status });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "supabase service role not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const offsetParam = Number(url.searchParams.get("offset") ?? "0");
    const limitParam = Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT));
    const liveOnlyParam = (url.searchParams.get("liveOnly") ?? "true").toLowerCase();
    const liveOnly = liveOnlyParam !== "false";
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? Math.floor(offsetParam) : 0;
    const requestedLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : DEFAULT_LIMIT;
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let query = adminClient
      .from("lives")
      .select("id, title, status, created_at, creator_id")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (liveOnly) {
      query = query.eq("status", "live");
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as LiveRow[];
    const creatorIds = Array.from(new Set(rows.map((item) => item.creator_id).filter((id): id is string => Boolean(id))));

    const whatsappByCreator: Record<string, string | null> = {};
    for (const creatorId of creatorIds) {
      try {
        const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(creatorId);
        if (userError || !userData.user) {
          whatsappByCreator[creatorId] = null;
          continue;
        }

        const metadata = (userData.user.user_metadata ?? {}) as Record<string, unknown>;
        whatsappByCreator[creatorId] = normalizeWhatsapp(metadata.creator_whatsapp);
      } catch {
        whatsappByCreator[creatorId] = null;
      }
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      creator_whatsapp: row.creator_id ? whatsappByCreator[row.creator_id] ?? null : null,
    }));

    return NextResponse.json({ rows: enrichedRows, liveOnly }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}