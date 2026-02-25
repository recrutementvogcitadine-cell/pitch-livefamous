import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = pkg;

const appId = process.argv[2] || process.env.AGORA_APP_ID;
const appCert = process.argv[3] || process.env.AGORA_APP_CERT;
const channel = process.argv[4] || 'test-channel';
const ttl = Number(process.argv[5]) || 60 * 60;

if (!appId || !appCert) {
  console.error('Usage: node generate-agora-token.mjs <APP_ID> <APP_CERT> [channel] [ttl_seconds]');
  process.exit(2);
}

const uid = 0;
const expire = Math.floor(Date.now() / 1000) + ttl;
const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channel, uid, RtcRole.PUBLISHER, expire);
console.log(token);
