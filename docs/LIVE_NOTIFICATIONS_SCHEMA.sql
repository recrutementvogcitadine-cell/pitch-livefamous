-- Live notifications schema (followers + push subscriptions)
-- Run in Supabase SQL Editor.

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

-- Keep updated_at fresh on upserts/updates.
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_live_push_subscriptions_updated_at on public.live_push_subscriptions;
create trigger trg_live_push_subscriptions_updated_at
before update on public.live_push_subscriptions
for each row
execute function public.set_updated_at_timestamp();
