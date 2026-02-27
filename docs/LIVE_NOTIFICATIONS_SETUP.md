# Live Notifications Setup (Followers)

Companion files:

- SQL ready-to-run: `docs/LIVE_NOTIFICATIONS_SCHEMA.sql`
- Real-device QA checklist: `docs/LIVE_NOTIFICATIONS_TEST_CHECKLIST.md`

## 1) SQL (Supabase)

```sql
create table if not exists public.live_creator_followers (
  creator_user_id uuid not null,
  follower_user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (creator_user_id, follower_user_id)
);

create index if not exists live_creator_followers_follower_idx
  on public.live_creator_followers (follower_user_id);

create table if not exists public.live_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_push_subscriptions_user_idx
  on public.live_push_subscriptions (user_id);
```

## 2) Env variables

Set these in local and Vercel:

- `NEXT_PUBLIC_APP_URL` (ex: `https://your-domain.com`)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (ex: `mailto:ops@your-domain.com`)
- `SUPABASE_SERVICE_ROLE` (or `SUPABASE_SERVICE_ROLE_KEY`)

## 3) VAPID key generation

```bash
npx web-push generate-vapid-keys
```

Copy the generated public/private keys to env vars.

## 4) Runtime flow

1. User clicks **Activer notifications live** (`/watch`) and accepts browser notification permission.
2. Browser subscription is sent to `POST /api/live-notify/subscribe`.
3. Spectator clicks **Suivre** on a creator.
4. Creator clicks **Notifier mes followers** while live.
5. Followers receive push notification with action **Voir le live** opening `/lives/:id`.
