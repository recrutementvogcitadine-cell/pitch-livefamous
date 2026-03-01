import pkg from 'agora-access-token';
import { resolveCurrentUser, isValidatedCreatorMeta } from "../../_lib/creator-access";
const { RtcTokenBuilder, RtcRole } = pkg;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const channel = url.searchParams.get('channel') ?? 'test-channel';
    const ttl = Number(url.searchParams.get('ttl')) || 60 * 60; // seconds

    const appId = (process.env.AGORA_APP_ID ?? process.env.NEXT_PUBLIC_AGORA_APP_ID ?? '').trim();
    const appCert = (process.env.AGORA_APP_CERT ?? process.env.AGORA_APP_CERTIFICATE ?? '').trim();
    const tokenSecret = (process.env.AGORA_TOKEN_SECRET ?? '').trim();
    // Admin mode: if caller requests `?admin=true` (or header `x-agora-admin`), require the server secret.
    // Regular frontend calls do NOT need to provide the secret — the server uses the private AGORA_APP_CERT
    // to sign tokens and the secret remains server-only. For stronger protection, enable `AGORA_TOKEN_SECRET`
    // and ensure clients authenticate to your app before calling this endpoint.
    const adminRequested = (url.searchParams.get('admin') || '').toLowerCase() === 'true' || req.headers.get('x-agora-admin') === '1';
    if (adminRequested) {
      if (!tokenSecret) {
        return new Response(JSON.stringify({ error: 'admin mode not available' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      const provided = req.headers.get('x-agora-token-secret') || url.searchParams.get('secret') || '';
      if (!provided || provided !== tokenSecret) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
    }
    if (!appId) {
      return new Response(JSON.stringify({ error: 'AGORA_APP_ID not set' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (appId.length !== 32) {
      return new Response(JSON.stringify({ error: 'AGORA_APP_ID invalid format' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    if (appCert && appCert.length !== 32) {
      return new Response(JSON.stringify({ error: 'AGORA_APP_CERT invalid format' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // uid can be provided by caller or generated server-side to avoid collisions
    const uidParam = Number(url.searchParams.get('uid'));
    const uid = Number.isFinite(uidParam) && uidParam > 0 ? uidParam : Math.floor(Math.random() * 1_000_000);
    const roleParam = (url.searchParams.get('role') ?? 'publisher').toLowerCase();
    const role = roleParam === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    if (roleParam !== 'subscriber') {
      const user = await resolveCurrentUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: 'unauthorized_creator_required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      if (!isValidatedCreatorMeta(meta)) {
        return new Response(JSON.stringify({ error: 'creator_validation_required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const expire = Math.floor(Date.now() / 1000) + ttl;
    if (!appCert) {
      return new Response(
        JSON.stringify({ token: null, channel, uid, appId, expires_at: expire, mode: 'app_id_only' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channel, uid, role, expire);

    return new Response(JSON.stringify({ token, channel, uid, appId, expires_at: expire }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
