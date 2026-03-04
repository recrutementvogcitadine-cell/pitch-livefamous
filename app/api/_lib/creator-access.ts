import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, type User } from "@supabase/supabase-js";

const RESOLVE_AUTH_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("auth timeout")), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export type CreatorAccessState = {
  isAuthenticated: boolean;
  isValidatedCreator: boolean;
  accountType: string;
  creatorRequestStatus: string;
  creatorRole: string;
  shouldRedirectToCreatorForm: boolean;
  launchHref: string;
  creatorFormHref: string;
};

export function isValidatedCreatorMeta(meta: Record<string, unknown>) {
  const accountType = typeof meta.account_type === "string" ? meta.account_type.trim().toLowerCase() : "";
  const creatorRole = typeof meta.creator_role === "string" ? meta.creator_role.trim().toLowerCase() : "";
  const requestStatus = typeof meta.creator_request_status === "string" ? meta.creator_request_status.trim().toLowerCase() : "";

  return (
    accountType === "creator" ||
    accountType === "creator_validated" ||
    accountType === "creator_pending" ||
    requestStatus === "pending_admin" ||
    creatorRole === "validated" ||
    Boolean(meta.creator_verified) ||
    Boolean(meta.seller_active) ||
    Boolean(meta.creator_is_certified) ||
    Boolean(meta.is_certified)
  );
}

async function resolveUserFromBearer(req?: Request): Promise<User | null> {
  if (!req) return null;

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearerToken) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const anonClient = createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
  } = await withTimeout(anonClient.auth.getUser(bearerToken), RESOLVE_AUTH_TIMEOUT_MS);

  return user ?? null;
}

export async function resolveCurrentUser(req?: Request): Promise<User | null> {
  try {
    const serverClient = await createServerClient();
    const {
      data: { user },
    } = await withTimeout(serverClient.auth.getUser(), RESOLVE_AUTH_TIMEOUT_MS);

    if (user) return user;
  } catch {
    return resolveUserFromBearer(req);
  }

  return resolveUserFromBearer(req);
}

export async function resolveCreatorAccessState(req?: Request): Promise<CreatorAccessState> {
  const user = await resolveCurrentUser(req);
  const creatorFormHref = "/auth?mode=creator";
  const launchHref = "/creator/studio";

  if (!user) {
    return {
      isAuthenticated: false,
      isValidatedCreator: false,
      accountType: "spectator",
      creatorRequestStatus: "none",
      creatorRole: "none",
      shouldRedirectToCreatorForm: true,
      launchHref,
      creatorFormHref,
    };
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const accountType = typeof meta.account_type === "string" ? meta.account_type : "spectator";
  const creatorRequestStatus =
    typeof meta.creator_request_status === "string" ? meta.creator_request_status : "none";
  const creatorRole = typeof meta.creator_role === "string" ? meta.creator_role : "none";
  const isValidatedCreator = isValidatedCreatorMeta(meta);

  return {
    isAuthenticated: true,
    isValidatedCreator,
    accountType,
    creatorRequestStatus,
    creatorRole,
    shouldRedirectToCreatorForm: !isValidatedCreator,
    launchHref,
    creatorFormHref,
  };
}
