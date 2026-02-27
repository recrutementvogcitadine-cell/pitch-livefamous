Deploy to Vercel — quick guide

This project is ready to deploy to Vercel via GitHub. Follow these steps for the fastest path to production and to enable real-time testing with authenticated users.

1) Connect your GitHub repo to Vercel
- In Vercel, import the GitHub repository and select the branch you want to deploy (e.g. `main` or `feat/agora-production`). Vercel will create automatic deployments on push.

2) Add required environment variables
- Required for Agora + Supabase features:
  - `AGORA_APP_ID` (value: your Agora App ID)
  - `AGORA_APP_CERT` (value: your Agora App Certificate — keep secret)
  - `AGORA_TOKEN_SECRET` (optional shared secret for admin calls)
  - `NEXT_PUBLIC_AGORA_APP_ID` (optional, same as `AGORA_APP_ID` for client prefill)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE` (only if you plan to seed server-side)

- You can set these in the Vercel dashboard under Project → Settings → Environment Variables.

3) (Optional) Use the included helper to programmatically add envs
- If you prefer to script the variable creation, run locally (you need `VERCEL_TOKEN` and `VERCEL_PROJECT_ID`):

```bash
# export VERCEL_TOKEN and VERCEL_PROJECT_ID first
VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=yyy bash scripts/setup-vercel-env.sh
```

4) Trigger a deployment
- Push to the connected branch or trigger a redeploy in the Vercel dashboard.

5) Verify endpoints
- Visit `https://<your-deployment>/api/health` — should return `{ "ok": true }`.
- Visit `https://<your-deployment>/api/agora/token?channel=test` — should return a JSON token.

6) Test real-time with authenticated users
- Use Supabase auth (email/password or OAuth) to sign users in. The client demo `app/agora-test/page.tsx` will fetch a token from `/api/agora/token` when the token field is empty.
- Recommended: protect `/api/agora/token` behind your app authentication (session/JWT) rather than only `AGORA_TOKEN_SECRET` for user-specific tokens.

7) (Optional) Add CI for e2e tests
- If you want automated Playwright tests on each deploy/PR, I can add a GitHub Action that:
  - Deploys to Vercel via the Vercel API
  - Runs Playwright tests against the deployment URL (requires VERCEL_TOKEN and VERCEL_PROJECT_ID as GitHub secrets)

If you want, provide `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` and I will:
- Run the `scripts/setup-vercel-env.sh` for you, and
- Optionally create a GitHub Action to run Playwright e2e on every push/PR.
