import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const channel = url.searchParams.get('channel') ?? 'test-channel';
    const ttl = Number(url.searchParams.get('ttl')) || 60 * 60; // seconds

    const appId = process.env.AGORA_APP_ID;
    const appCert = process.env.AGORA_APP_CERT;
    const tokenSecret = process.env.AGORA_TOKEN_SECRET;
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
    if (!appId || !appCert) {
      return new Response(JSON.stringify({ error: 'AGORA_APP_ID or AGORA_APP_CERT not set' }), { status: 500 });
    }

    // uid can be provided by caller or generated server-side to avoid collisions
    const uidParam = Number(url.searchParams.get('uid'));
    const uid = Number.isFinite(uidParam) && uidParam > 0 ? uidParam : Math.floor(Math.random() * 1_000_000);
    const roleParam = (url.searchParams.get('role') ?? 'publisher').toLowerCase();
    const role = roleParam === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
    const expire = Math.floor(Date.now() / 1000) + ttl;
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channel, uid, role, expire);

    return new Response(JSON.stringify({ token, channel, expires_at: expire }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
