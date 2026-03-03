import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { toLiveLifecycleState } from "@/lib/live-states";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  creator_id: string | null;
  creator_whatsapp?: string | null;
  creator_verified?: boolean | null;
  creator_is_certified?: boolean | null;
  is_certified?: boolean | null;
};

function normalizeWhatsapp(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^\d+]/g, "").trim();
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length < 8) return null;
  return cleaned.slice(0, 30);
}

function pickCreatorWhatsapp(metadata: Record<string, unknown>) {
  return normalizeWhatsapp(metadata.creator_whatsapp);
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

    let rows: LiveRow[] = [];

    const liveStreamsSelect =
      "id, title, status, created_at, creator_id, creator_whatsapp, creator_verified, creator_is_certified, is_certified";

    let liveStreamsQuery = adminClient
      .from("live_streams")
      .select(liveStreamsSelect)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (liveOnly) {
      liveStreamsQuery = liveStreamsQuery.in("status", ["live", "active"]);
    }

    const liveStreamsResult = await liveStreamsQuery;

    if (!liveStreamsResult.error) {
      rows = (liveStreamsResult.data ?? []) as LiveRow[];
    } else {
      let legacyQuery = adminClient
        .from("lives")
        .select("id, title, status, created_at, creator_id")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (liveOnly) {
        legacyQuery = legacyQuery.in("status", ["live", "active"]);
      }

      const legacyResult = await legacyQuery;
      if (legacyResult.error) {
        return NextResponse.json({ error: legacyResult.error.message }, { status: 500 });
      }
      rows = (legacyResult.data ?? []) as LiveRow[];
    }
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
        whatsappByCreator[creatorId] = pickCreatorWhatsapp(metadata);
      } catch {
        whatsappByCreator[creatorId] = null;
      }
    }

    const enrichedRows = rows.map((row) => ({
      ...row,
      lifecycleState: toLiveLifecycleState(row.status),
      creator_whatsapp:
        row.creator_whatsapp ?? (row.creator_id ? whatsappByCreator[row.creator_id] ?? null : null),
      creator_verified: row.creator_verified ?? null,
      creator_is_certified: row.creator_is_certified ?? null,
      is_certified: row.is_certified ?? null,
    }));

    return NextResponse.json({ rows: enrichedRows, liveOnly }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}