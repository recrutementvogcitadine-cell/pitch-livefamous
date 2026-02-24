This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production deployment (recommended)

This repo includes convenience artifacts to deploy the app to a container platform or to use Vercel.

- Dockerfile: build a production image and run `npm run start`.
- GitHub Actions workflow: builds the app and publishes a Docker image to GitHub Container Registry (GHCR). Optionally you can enable an SSH-based deploy step.

Required environment variables (set these in your host or GitHub / Vercel project settings):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE` (server-only secret; do NOT commit to the repository)

Quick steps — Docker / self-host:

1. Build & run locally with Docker:

```bash
docker build -t pitch-livefamous:local .
docker run -e NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
	-e NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
	-e SUPABASE_SERVICE_ROLE="${SUPABASE_SERVICE_ROLE}" \
	-p 3000:3000 pitch-livefamous:local
```

2. Or use the included GitHub Actions to build & publish a container to GHCR. Set the required repository secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`) in GitHub > Settings > Secrets.

Quick steps — Vercel:

1. Connect the repository to Vercel.
2. In Vercel Project Settings > Environment Variables, add the three variables above (make `SUPABASE_SERVICE_ROLE` a Secret/Production-only variable).

Health check endpoint: `GET /api/health` returns `{ ok: true }`.

If you want, I can: add an SSH deploy target in GitHub Actions (you'll need to provide server SSH secrets), or configure a Vercel deployment for you.
