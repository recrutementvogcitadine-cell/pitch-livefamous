# Live IA MVP (Famous AI)

## Variables d'environnement

Ajouter dans `.env.local` et Vercel:

- `OPENAI_API_KEY` (obligatoire pour réponses IA avancées)
- `OPENAI_MODEL` (optionnel, défaut: `gpt-4.1-mini`)
- `OPENAI_COMPLEX_MODEL` (optionnel, défaut: `gpt-4.1`)
- `LIVE_AI_COOLDOWN_MS` (optionnel, défaut: `3500`)
- `LIVE_AI_MAX_PER_MINUTE` (optionnel, défaut: `10`)
- `LIVE_AI_ACTIVE_AGENT_SLOTS` (optionnel, défaut: `6`, min 2, max 10)
- `LIVE_AI_MONTHLY_BUDGET_USD` (optionnel, défaut: `250`)

Le endpoint fonctionne aussi sans clé avec un fallback local.

## Orchestration multi-agents (20 profils)

- Pool interne: 20 agents IA (`10 hommes`, `10 femmes`).
- Rotation automatique par live + fenêtre de temps.
- Roster actif limité (par défaut 6 agents simultanés) pour maîtriser la charge.
- Le backend renvoie `agent` (agent actif), `activeAgents` (roster), `budget` et `modelUsed`.
- Si le budget mensuel est atteint, le backend passe en mode réponse courte automatiquement.

## Endpoint

- `POST /api/live-ai/reply`
- `GET /api/live-ai/reply?liveId=<id>`
- Auth requise (session Supabase)
- Payload:

```json
{
  "liveId": "<uuid-ou-id-live>",
  "message": "question utilisateur",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Réponse:

```json
{
  "liveId": "...",
  "reply": "...",
  "disclosure": "Je suis un assistant virtuel IA en direct.",
  "confidence": 0.84,
  "escalated": false
}
```

## UI livrée

- Bouton `🤖 AI Live` sur chaque carte live dans `watch`.
- Panneau Q&A temps réel avec envoi message + réponse IA.
- Badge de transparence `Créateur virtuel IA` visible sur le live.
- Chargement auto de l'historique Q&A quand on ouvre le panneau IA.
- Protection anti-spam serveur (cooldown + plafond/minute) avec retour utilisateur.
- Filtrage basique des messages non conformes avant génération IA.
- Escalade auto vers modérateur pour questions hors périmètre sensible.

## Persistance messages (SQL)

Pour activer le stockage + lecture de l'historique Q&A, exécute ce SQL dans Supabase:

```sql
create table if not exists live_ai_messages (
  id uuid primary key default gen_random_uuid(),
  live_id text not null,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_ai_messages_live_created
  on live_ai_messages(live_id, created_at desc);

alter table live_ai_messages enable row level security;

drop policy if exists "live_ai_messages_select_own" on live_ai_messages;
create policy "live_ai_messages_select_own"
  on live_ai_messages for select
  using (auth.uid() = user_id);

drop policy if exists "live_ai_messages_insert_own" on live_ai_messages;
create policy "live_ai_messages_insert_own"
  on live_ai_messages for insert
  with check (auth.uid() = user_id);
```

## Personas par live (ultra réaliste)

Optionnel: personnaliser le style IA par room/live.

```sql
create table if not exists live_ai_personas (
  id uuid primary key default gen_random_uuid(),
  live_id text unique not null,
  persona_name text,
  language text default 'français',
  tone text default 'pro, chaleureux',
  niche text default 'plateforme live',
  system_prompt text,
  updated_at timestamptz not null default now()
);

alter table live_ai_personas enable row level security;

drop policy if exists "live_ai_personas_select_auth" on live_ai_personas;
create policy "live_ai_personas_select_auth"
  on live_ai_personas for select
  using (auth.uid() is not null);
```

Exemple:

```sql
insert into live_ai_personas (live_id, persona_name, language, tone, niche)
values ('live-demo-1', 'Nina Live', 'français', 'énergique et bienveillant', 'coaching créateur')
on conflict (live_id) do update
set persona_name = excluded.persona_name,
    language = excluded.language,
    tone = excluded.tone,
    niche = excluded.niche,
    updated_at = now();
```

## Mémoire courte par viewer (24h)

Optionnel: conserver un contexte léger par utilisateur + live pour des réponses plus naturelles.

```sql
create table if not exists live_ai_viewer_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  live_id text not null,
  preferences text,
  frequent_topics text,
  last_intent text,
  updated_at timestamptz not null default now(),
  unique(user_id, live_id)
);

create index if not exists idx_live_ai_viewer_memory_updated
  on live_ai_viewer_memory(updated_at desc);

alter table live_ai_viewer_memory enable row level security;

drop policy if exists "live_ai_viewer_memory_select_own" on live_ai_viewer_memory;
create policy "live_ai_viewer_memory_select_own"
  on live_ai_viewer_memory for select
  using (auth.uid() = user_id);

drop policy if exists "live_ai_viewer_memory_upsert_own" on live_ai_viewer_memory;
create policy "live_ai_viewer_memory_upsert_own"
  on live_ai_viewer_memory for insert
  with check (auth.uid() = user_id);

drop policy if exists "live_ai_viewer_memory_update_own" on live_ai_viewer_memory;
create policy "live_ai_viewer_memory_update_own"
  on live_ai_viewer_memory for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## Escalations modération (optionnel)

```sql
create table if not exists live_ai_escalations (
  id uuid primary key default gen_random_uuid(),
  live_id text not null,
  user_id uuid not null,
  question text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution_note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table live_ai_escalations
  add column if not exists status text not null default 'open' check (status in ('open','resolved'));
alter table live_ai_escalations
  add column if not exists resolution_note text;
alter table live_ai_escalations
  add column if not exists resolved_by uuid;
alter table live_ai_escalations
  add column if not exists resolved_at timestamptz;

create index if not exists idx_live_ai_escalations_live_created
  on live_ai_escalations(live_id, created_at desc);

alter table live_ai_escalations enable row level security;

drop policy if exists "live_ai_escalations_insert_own" on live_ai_escalations;
create policy "live_ai_escalations_insert_own"
  on live_ai_escalations for insert
  with check (auth.uid() = user_id);

drop policy if exists "live_ai_escalations_update_auth" on live_ai_escalations;
create policy "live_ai_escalations_update_auth"
  on live_ai_escalations for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```
