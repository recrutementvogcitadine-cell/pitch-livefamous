import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return null;

  return createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return { ok: false as const, error: "VAPID env missing" };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true as const };
}

async function getUserFromRequest(req: Request) {
  const serverClient = await createServerClient();
  const {
    data: { user: cookieUser },
  } = await serverClient.auth.getUser();

  if (cookieUser) return cookieUser;

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearerToken) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: bearerUser },
  } = await anonClient.auth.getUser(bearerToken);

  return bearerUser ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE missing" }, { status: 503 });
    }

    const vapid = configureWebPush();
    if (!vapid.ok) {
      return NextResponse.json({ error: vapid.error }, { status: 503 });
    }

    const payload = (await req.json()) as { liveId?: string; title?: string };
    const liveId = payload.liveId?.trim();
    const liveTitle = payload.title?.trim() || "Live en direct";

    if (!liveId) {
      return NextResponse.json({ error: "liveId required" }, { status: 400 });
    }

    const { data: followers, error: followersError } = await admin
      .from("live_creator_followers")
      .select("follower_user_id")
      .eq("creator_user_id", user.id);

    if (followersError) {
      return NextResponse.json({ error: followersError.message }, { status: 500 });
    }

    const followerIds = Array.from(new Set((followers ?? []).map((row) => row.follower_user_id as string).filter(Boolean)));

    if (followerIds.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 }, { status: 200 });
    }

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("live_push_subscriptions")
      .select("endpoint,p256dh,auth,user_id")
      .in("user_id", followerIds);

    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const liveUrl = `${origin}/lives/${encodeURIComponent(liveId)}`;
    const avatarUrl =
      ((user.user_metadata ?? {}) as Record<string, unknown>).avatar_url ||
      ((user.user_metadata ?? {}) as Record<string, unknown>).picture ||
      `${origin}/icon-192x192.png`;

    const body = JSON.stringify({
      title: `🔴 ${liveTitle}`,
      body: `${user.email ?? "Créateur"} est en direct`,
      icon: String(avatarUrl),
      image: String(avatarUrl),
      data: { url: liveUrl, liveId },
      actions: [{ action: "view", title: "Voir le live" }],
      tag: `live-${liveId}`,
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const row of subscriptions ?? []) {
      const endpoint = String(row.endpoint ?? "");
      const p256dh = String(row.p256dh ?? "");
      const auth = String(row.auth ?? "");
      if (!endpoint || !p256dh || !auth) continue;

      try {
        await webpush.sendNotification(
          {
            endpoint,
            keys: { p256dh, auth },
          },
          body
        );
        sent += 1;
      } catch (error: unknown) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(endpoint);
        }
      }
    }

    if (staleEndpoints.length > 0) {
      await admin.from("live_push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return NextResponse.json({ ok: true, sent, followers: followerIds.length }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: "send live notify failed", detail: String(error) }, { status: 500 });
  }
}
