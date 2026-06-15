-- ============================================================================
-- Message ingestion + coach approval queue.
--
-- Flow: a message is ingested (message_ingest), matched to an athlete, and the
-- classifier proposes zero-or-more suggested_actions (status 'pending'). NOTHING
-- is prescribed automatically — a prescription row is created ONLY when a coach
-- approves a suggestion. Sensitive (medical/supplement) items are flagged for
-- manual review.
--
-- RLS mirrors the rest of the app (coach-scoped; client-facing prescriptions
-- readable by the linked athlete) using the helpers from 0002_rls.sql.
-- ============================================================================

create type message_source     as enum ('gmail', 'sms', 'imessage', 'whatsapp', 'manual', 'csv', 'json');
create type message_match      as enum ('phone', 'email', 'name', 'unmatched');
create type suggestion_domain  as enum ('diet', 'supplementation', 'altolab', 'low_base', 'hydration', 'recovery', 'labs', 'training');
create type suggestion_status  as enum ('pending', 'approved', 'edited', 'rejected');
create type prescription_status as enum ('active', 'completed', 'cancelled');

-- ---- raw ingested messages -------------------------------------------------
create table message_ingest (
  id               uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references profiles(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,
  source           message_source not null default 'manual',
  external_id      text,                 -- provider id, for dedupe
  sender_name      text,
  sender_phone     text,
  sender_email     text,
  body             text not null,
  received_at      timestamptz,
  match_method     message_match not null default 'unmatched',
  match_confidence numeric(4,3) not null default 0,
  raw              jsonb,
  created_at       timestamptz not null default now()
);
-- Dedupe the same provider message per coach.
create unique index message_ingest_external_uq
  on message_ingest (coach_id, source, external_id) where external_id is not null;
create index message_ingest_coach_idx on message_ingest (coach_id, created_at desc);

-- ---- prescriptions (created only on approval) ------------------------------
create table prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id) on delete cascade,
  client_id           uuid not null references clients(id) on delete cascade,
  domain              suggestion_domain not null,
  title               text not null,
  protocol            text not null,
  details             jsonb,
  source_suggestion_id uuid,            -- soft link (no FK to avoid a cycle)
  status              prescription_status not null default 'active',
  starts_on           date,
  ends_on             date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index prescriptions_client_idx on prescriptions (client_id, created_at desc);

-- ---- suggested actions (the approval queue) --------------------------------
create table suggested_actions (
  id                 uuid primary key default gen_random_uuid(),
  coach_id           uuid not null references profiles(id) on delete cascade,
  client_id          uuid references clients(id) on delete set null,
  message_id         uuid not null references message_ingest(id) on delete cascade,
  domain             suggestion_domain not null,
  intent             text,
  suggested_protocol text not null,
  details            jsonb,
  confidence         numeric(4,3) not null default 0,
  sensitive          boolean not null default false,
  status             suggestion_status not null default 'pending',
  reviewed_by        uuid references profiles(id) on delete set null,
  reviewed_at        timestamptz,
  prescription_id    uuid references prescriptions(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now()
);
create index suggested_actions_queue_idx on suggested_actions (coach_id, status, created_at desc);

-- ---- RLS -------------------------------------------------------------------
alter table message_ingest    enable row level security;
alter table suggested_actions enable row level security;
alter table prescriptions     enable row level security;

create policy message_ingest_coach on message_ingest for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

create policy suggested_actions_coach on suggested_actions for all
  using (coach_id = current_profile_id())
  with check (coach_id = current_profile_id());

-- Prescriptions: coach manages; linked athlete can read their own.
create policy prescriptions_read on prescriptions for select
  using (owns_client(client_id));
create policy prescriptions_write on prescriptions for all
  using (is_client_coach(client_id))
  with check (is_client_coach(client_id));
