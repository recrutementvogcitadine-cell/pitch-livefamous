Agora token endpoint and deployment

Overview

- This project exposes `/api/agora/token` which generates Agora RTC tokens server-side using `AGORA_APP_ID` and `AGORA_APP_CERT`.
- The token signing keys must remain server-only (never checked into source).

Environment variables (set in production):

- `AGORA_APP_ID` — Agora App ID (public)
- `AGORA_APP_CERT` — Agora App Certificate (secret, server-only)
- `AGORA_TOKEN_SECRET` — Optional: a secret you can use to protect admin-mode token generation
- `NEXT_PUBLIC_AGORA_APP_ID` — Optional public copy of your App ID for client prefill

Token endpoint behavior

- Regular client calls: `GET /api/agora/token?channel=my-channel` will return a signed token. No secret is required for regular calls.
- Admin mode: `GET /api/agora/token?admin=true&channel=my-channel` requires `AGORA_TOKEN_SECRET` to be set on the server and the request must include `x-agora-token-secret` header or `?secret=` query matching it.

Security recommendations

- Prefer protecting the token endpoint by authenticating your users (session/Cookie/JWT) instead of relying on a shared secret.
- If you enable `AGORA_TOKEN_SECRET`, do NOT pass that secret to client-side code. Use it only for server-to-server admin calls.
- Rotate `AGORA_APP_CERT` and `AGORA_TOKEN_SECRET` if they may have been exposed.

Local development

- Create a `.env.local` with `AGORA_APP_ID`, `AGORA_APP_CERT`, and optional `AGORA_TOKEN_SECRET`.
- `NEXT_PUBLIC_AGORA_APP_ID` can be set for the demo page to prefill the App ID.

Admin script

- `scripts/generate-agora-token.mjs` is provided to generate tokens from the command line using your env vars:

```bash
node scripts/generate-agora-token.mjs
# or with explicit args
node scripts/generate-agora-token.mjs <APP_ID> <APP_CERT> [channel] [ttl_seconds]
```

Deploying to Vercel or similar

- Add the required env vars in the hosting provider's dashboard (AGORA_APP_ID, AGORA_APP_CERT, NEXT_PUBLIC_AGORA_APP_ID). If you choose to use `AGORA_TOKEN_SECRET`, set it too but do not expose it to the client.
- After deployment, verify `/api/health` and `/api/agora/token?channel=test`.
