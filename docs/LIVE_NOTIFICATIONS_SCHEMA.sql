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

create table if not exists public.live_notification_events (
  id bigint generated always as identity primary key,
  creator_user_id uuid not null,
  live_id uuid not null,
  follower_count integer not null default 0,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists live_notification_events_created_idx
  on public.live_notification_events (created_at desc);

create index if not exists live_notification_events_creator_idx
  on public.live_notification_events (creator_user_id);

create table if not exists public.app_button_labels (
  id integer primary key,
  go_live_label text not null default 'Passer en live caméra',
  go_live_creator_label text not null default 'Passer en live (créateur)',
  become_creator_label text not null default 'Devenir créateur',
  allow_agent_edit boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint app_button_labels_singleton check (id = 1)
);

insert into public.app_button_labels (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.creator_live_schedule (
  creator_user_id uuid primary key,
  next_live_at timestamptz,
  announcement text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_live_schedule_next_live_idx
  on public.creator_live_schedule (next_live_at);

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

drop trigger if exists trg_creator_live_schedule_updated_at on public.creator_live_schedule;
create trigger trg_creator_live_schedule_updated_at
before update on public.creator_live_schedule
for each row
execute function public.set_updated_at_timestamp();
