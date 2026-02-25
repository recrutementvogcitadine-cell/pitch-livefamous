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
    // Simple auth: require a header or query param 'secret' matching AGORA_TOKEN_SECRET if it is set
    if (tokenSecret) {
      const provided = req.headers.get('x-agora-token-secret') || url.searchParams.get('secret') || '';
      if (provided !== tokenSecret) {
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
