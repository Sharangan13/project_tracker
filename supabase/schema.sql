-- =============================================================================
-- Module Task Tracker v2 — Supabase / PostgreSQL schema
-- Paste into Supabase: SQL Editor > New query > Run.  Safe to re-run.
--
-- The app connects with DATABASE_URL (server side only) and does its own
-- authentication (users + user_sessions tables). It does NOT use Supabase Auth.
-- Row Level Security is enabled on every table with no policies, so nobody can
-- read or write these tables through Supabase's public REST API / anon key.
--
-- New table names (users, teams, team_memberships, team_tasks, activity_logs,
-- user_sessions, login_attempts) do not collide with the v1 tables
-- (members, tasks, history, profiles), so v1 data is left untouched.
-- =============================================================================

-- ---------- Accounts ----------
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique,
  display_name    text not null,
  password_hash   text not null,
  -- Set when a team leader created this login. Only that team's leader may reset
  -- the password (and only while the account belongs to no other team).
  managed_by_team uuid,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[a-z0-9._-]{3,30}$'),
  constraint users_display_name_len check (char_length(display_name) between 1 and 60)
);

-- ---------- Teams ----------
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- 8-character code used on the "Login to a Team" form.
  code       text not null unique,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_len check (char_length(name) between 2 and 60),
  constraint teams_code_format check (code ~ '^[A-Z0-9]{8}$')
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_managed_by_team_fkey') then
    alter table users
      add constraint users_managed_by_team_fkey
      foreign key (managed_by_team) references teams(id) on delete set null;
  end if;
end $$;

-- A user can belong to many teams, with a separate role in each.
create table if not exists team_memberships (
  team_id    uuid not null references teams(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null default 'member' check (role in ('leader', 'member')),
  is_active  boolean not null default true,
  added_by   uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_memberships_user_idx on team_memberships (user_id);

-- ---------- Tasks ----------
create table if not exists team_tasks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  num          int  not null check (num > 0),
  label        text not null check (char_length(label) between 1 and 60),
  note         text not null default '' check (char_length(note) <= 500),
  assignee_id  uuid references users(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'completed')),
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  assigned_at  timestamptz,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  unique (team_id, num)
);
create index if not exists team_tasks_team_status_idx on team_tasks (team_id, status);
create index if not exists team_tasks_assignee_idx on team_tasks (assignee_id);

-- ---------- Activity history ----------
create table if not exists activity_logs (
  id             bigint generated always as identity primary key,
  team_id        uuid references teams(id) on delete cascade,
  actor_id       uuid references users(id) on delete set null,
  actor_name     text not null,                 -- snapshot, survives account deletion
  action         text not null,                 -- e.g. task.created, member.added
  entity_type    text not null check (entity_type in ('team', 'member', 'task')),
  entity_id      uuid,
  target_user_id uuid references users(id) on delete set null,
  message        text not null,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists activity_team_time_idx on activity_logs (team_id, created_at desc);
create index if not exists activity_actor_idx on activity_logs (actor_id);
create index if not exists activity_target_idx on activity_logs (target_user_id);
create index if not exists activity_action_idx on activity_logs (action);

-- ---------- Sessions & throttling ----------
-- Only a SHA-256 hash of the session token is stored.
create table if not exists user_sessions (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  user_id      uuid not null references users(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,  -- null = personal-account session
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index if not exists user_sessions_user_idx on user_sessions (user_id);
create index if not exists user_sessions_expires_idx on user_sessions (expires_at);

create table if not exists login_attempts (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_bucket_idx on login_attempts (bucket, created_at);

-- ---------- Triggers ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();
drop trigger if exists teams_set_updated_at on teams;
create trigger teams_set_updated_at before update on teams
  for each row execute function set_updated_at();
drop trigger if exists team_tasks_set_updated_at on team_tasks;
create trigger team_tasks_set_updated_at before update on team_tasks
  for each row execute function set_updated_at();

-- A task can only be assigned to an active member of the same team.
create or replace function team_tasks_check_assignee() returns trigger
language plpgsql as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from team_memberships m
     where m.team_id = new.team_id and m.user_id = new.assignee_id and m.is_active
  ) then
    raise exception 'Assignee must be an active member of the team.' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists team_tasks_check_assignee on team_tasks;
create trigger team_tasks_check_assignee before insert or update of assignee_id, team_id on team_tasks
  for each row execute function team_tasks_check_assignee();

-- Safety net: when someone is removed or deactivated, their tasks go back to "unassigned".
create or replace function memberships_release_tasks() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.is_active and not new.is_active) then
    update team_tasks
       set assignee_id = null, status = 'pending', assigned_at = null, completed_at = null
     where team_id = old.team_id and assignee_id = old.user_id;
  end if;
  return null;
end $$;
drop trigger if exists memberships_release_tasks on team_memberships;
create trigger memberships_release_tasks after delete or update of is_active on team_memberships
  for each row execute function memberships_release_tasks();

-- ---------- Lock the tables away from Supabase's public API ----------
alter table users            enable row level security;
alter table teams            enable row level security;
alter table team_memberships enable row level security;
alter table team_tasks       enable row level security;
alter table activity_logs    enable row level security;
alter table user_sessions    enable row level security;
alter table login_attempts   enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on users, teams, team_memberships, team_tasks, activity_logs, user_sessions, login_attempts from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on users, teams, team_memberships, team_tasks, activity_logs, user_sessions, login_attempts from authenticated;
  end if;
end $$;

-- =============================================================================
-- Optional clean-up of the v1 schema (ONLY if you no longer need the old data).
-- It is commented out on purpose; v1 tables are not used by this version.
--
-- drop table if exists history, tasks, members, profiles cascade;
-- (Old Supabase Auth users can be removed in Authentication > Users.)
-- =============================================================================
