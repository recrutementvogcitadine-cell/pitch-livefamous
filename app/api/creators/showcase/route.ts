import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type UserMeta = Record<string, unknown>;

type ShowcaseCreator = {
  id: string;
  username: string;
  avatarUrl: string;
  followersCount: number;
  isCertifiedBlue: boolean;
  isLive: boolean;
  activeLiveId: string | null;
  activeLiveTitle: string | null;
  liveStartedAt: string | null;
};

type LiveRow = {
  id: string;
  title: string | null;
  status: string | null;
  created_at: string | null;
  creator_id: string | null;
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) return null;

  return createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getString(meta: UserMeta, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function isValidatedCreator(meta: UserMeta) {
  const accountType = typeof meta.account_type === "string" ? meta.account_type.toLowerCase() : "";
  const creatorRole = typeof meta.creator_role === "string" ? meta.creator_role.toLowerCase() : "";
  return (
    accountType === "creator" ||
    accountType === "creator_validated" ||
    creatorRole === "validated" ||
    Boolean(meta.creator_verified) ||
    Boolean(meta.seller_active) ||
    Boolean(meta.creator_is_certified) ||
    Boolean(meta.is_certified)
  );
}

function toUsername(item: { email?: string | null; user_metadata?: UserMeta | null }) {
  const meta = (item.user_metadata ?? {}) as UserMeta;
  const explicit = getString(meta, ["username", "user_name", "display_name", "full_name", "name"]);
  if (explicit) return explicit;
  if (item.email) return item.email.split("@")[0] ?? "Créateur";
  return "Créateur";
}

function toAvatar(item: { user_metadata?: UserMeta | null }) {
  const meta = (item.user_metadata ?? {}) as UserMeta;
  const avatar = getString(meta, ["avatar_url", "picture", "photo_url", "profile_image", "image"]);
  return avatar || "/famous-ai-logo.svg";
}

function toIsCertifiedBlue(meta: UserMeta) {
  return Boolean(meta.creator_verified) || Boolean(meta.creator_is_certified) || Boolean(meta.is_certified);
}

export async function GET(req: Request) {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE missing" }, { status: 503 });
    }

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "24");
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 60) : 24;

    const { data: profileRows, error: profileError } = await admin
      .from("creator_profiles")
      .select("user_id, username, avatar_url, followers_count, is_certified, is_validated")
      .eq("is_validated", true)
      .order("followers_count", { ascending: false })
      .limit(limit);

    const creatorIdsFromProfiles = !profileError
      ? (profileRows ?? [])
          .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
          .filter((id): id is string => Boolean(id))
      : [];

    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allUsers = data.users ?? [];

    const validatedCreators =
      creatorIdsFromProfiles.length > 0
        ? allUsers.filter((item) => creatorIdsFromProfiles.includes(item.id)).slice(0, limit)
        : allUsers
            .filter((item) => {
              const meta = (item.user_metadata ?? {}) as UserMeta;
              return isValidatedCreator(meta);
            })
            .slice(0, limit);

    const creatorIds = validatedCreators.map((item) => item.id);

    let followersByCreator: Record<string, number> = {};

    if (creatorIds.length > 0) {
      const { data: followerRows, error: followerError } = await admin
        .from("live_creator_followers")
        .select("creator_user_id")
        .in("creator_user_id", creatorIds);

      if (!followerError) {
        followersByCreator = (followerRows ?? []).reduce<Record<string, number>>((acc, row) => {
          const creatorId = row.creator_user_id as string;
          acc[creatorId] = (acc[creatorId] ?? 0) + 1;
          return acc;
        }, {});
      }
    }

    const liveRowsByCreator: Record<string, LiveRow> = {};

    if (creatorIds.length > 0) {
      const { data: liveRows } = await admin
        .from("live_streams")
        .select("id,title,status,created_at,creator_id")
        .in("status", ["live", "active"])
        .in("creator_id", creatorIds)
        .order("created_at", { ascending: false })
        .limit(300);

      for (const row of (liveRows ?? []) as LiveRow[]) {
        const creatorId = row.creator_id;
        if (!creatorId) continue;
        if (!liveRowsByCreator[creatorId]) {
          liveRowsByCreator[creatorId] = row;
        }
      }
    }

    const profileByUserId = new Map<string, Record<string, unknown>>(
      ((profileRows ?? []) as Array<Record<string, unknown>>)
        .map((row) => {
          const userId = typeof row.user_id === "string" ? row.user_id : null;
          return userId ? ([userId, row] as const) : null;
        })
        .filter((entry): entry is readonly [string, Record<string, unknown>] => Boolean(entry))
    );

    const creators: ShowcaseCreator[] = validatedCreators.map((item) => {
      const meta = (item.user_metadata ?? {}) as UserMeta;
      const profile = profileByUserId.get(item.id);
      const activeLive = liveRowsByCreator[item.id];
      return {
        id: item.id,
        username:
          typeof profile?.username === "string" && profile.username.trim()
            ? profile.username.trim()
            : toUsername(item),
        avatarUrl:
          typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
            ? profile.avatar_url.trim()
            : toAvatar(item),
        followersCount:
          typeof profile?.followers_count === "number"
            ? profile.followers_count
            : followersByCreator[item.id] ?? 0,
        isCertifiedBlue:
          typeof profile?.is_certified === "boolean" ? profile.is_certified : toIsCertifiedBlue(meta),
        isLive: Boolean(activeLive),
        activeLiveId: activeLive?.id ?? null,
        activeLiveTitle: activeLive?.title ?? null,
        liveStartedAt: activeLive?.created_at ?? null,
      };
    });

    creators.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;

      if (a.isLive && b.isLive) {
        const timeA = a.liveStartedAt ? new Date(a.liveStartedAt).getTime() : 0;
        const timeB = b.liveStartedAt ? new Date(b.liveStartedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
      }

      return b.followersCount - a.followersCount;
    });

    return NextResponse.json(
      { creators },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: "showcase get failed", detail: String(error) }, { status: 500 });
  }
}
