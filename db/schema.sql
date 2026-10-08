-- Idempotent schema. Apply with `npm run db:setup`; safe to re-run.
-- Ids are text (uuid strings) so a malformed id from a client is a miss, not a cast error.

create table if not exists profiles (
  id text primary key default gen_random_uuid()::text,
  token text not null default gen_random_uuid()::text,
  name text not null,
  avatar_url text,
  -- Raw avatar image as a data URL. Served by /api/avatars/[id]; never selected in list queries.
  avatar_data text,
  height_cm double precision not null,
  weight_kg double precision not null,
  sex text not null check (sex in ('male', 'female')),
  show_bac_on_posts boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists drink_logs (
  id text primary key default gen_random_uuid()::text,
  profile_id text not null references profiles (id) on delete cascade,
  name text not null,
  volume_oz double precision,
  abv double precision,
  alcohol_g double precision not null,
  consumed_at timestamptz not null default now()
);

create index if not exists drink_logs_profile_idx on drink_logs (profile_id, consumed_at desc);

create table if not exists events (
  id text primary key default gen_random_uuid()::text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  title text not null,
  location text,
  maps_query text,
  notes text
);

create table if not exists challenges (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  points integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists point_events (
  id text primary key default gen_random_uuid()::text,
  profile_id text not null references profiles (id) on delete cascade,
  delta integer not null,
  reason text,
  challenge_id text references challenges (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists point_events_profile_idx on point_events (profile_id);

create table if not exists posts (
  id text primary key default gen_random_uuid()::text,
  profile_id text not null references profiles (id) on delete cascade,
  url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  caption text,
  -- Snapshot taken when the post was created; never recomputed.
  bac_at_post double precision,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_idx on posts (created_at desc);

create table if not exists post_reactions (
  post_id text not null references posts (id) on delete cascade,
  profile_id text not null references profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id, emoji)
);

create table if not exists post_comments (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references posts (id) on delete cascade,
  profile_id text not null references profiles (id) on delete cascade,
  body text not null,
  -- Snapshot taken when the comment was created; never recomputed.
  bac_at_comment double precision,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on post_comments (post_id, created_at);

-- Photo map (M8). Added with ALTER so databases created before it pick the columns up.
alter table events add column if not exists lat double precision;
alter table events add column if not exists lng double precision;
alter table posts add column if not exists lat double precision;
alter table posts add column if not exists lng double precision;
alter table posts add column if not exists location_source text;
alter table posts add column if not exists event_id text references events (id) on delete set null;

-- Existing posts keep their stored image; new uploads retain an original plus a preview.
alter table posts add column if not exists preview_url text;

-- Accounts (M9): name + password logins, sessions, rate limiting.
alter table profiles add column if not exists password_hash text;
alter table profiles add column if not exists must_change_password boolean not null default false;
alter table profiles add column if not exists session_version integer not null default 1;
-- The per-device token only survives until a pre-accounts profile sets a password.
alter table profiles alter column token drop not null;
-- Names are unique among accounts, ignoring case. Unclaimed legacy profiles are exempt.
create unique index if not exists profiles_account_name_idx on profiles (lower(name)) where password_hash is not null;

create table if not exists auth_attempts (
  key text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists auth_attempts_key_idx on auth_attempts (key, attempted_at);

-- Points economy (M11): drink points, awards, multipliers.
alter table drink_logs add column if not exists category text;

create table if not exists water_logs (
  id text primary key default gen_random_uuid()::text,
  profile_id text not null references profiles (id) on delete cascade,
  consumed_at timestamptz not null default now()
);

create index if not exists water_logs_profile_idx on water_logs (profile_id, consumed_at desc);

-- Points to one decimal place (a 1.4 standard drink at 3 points each is 4.2).
alter table point_events alter column delta type numeric(10, 1);
alter table point_events add column if not exists source text not null default 'admin';
alter table point_events add column if not exists breakdown jsonb;
-- No foreign key: the entry outlives the deleted drink, voided, so the history still shows it.
alter table point_events add column if not exists drink_id text;
alter table point_events add column if not exists group_id text;
alter table point_events add column if not exists award_key text;
alter table point_events add column if not exists voided_at timestamptz;
create unique index if not exists point_events_award_key_idx on point_events (award_key) where award_key is not null;
create index if not exists point_events_drink_idx on point_events (drink_id) where drink_id is not null;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Games (M12): notices, feed lines, curses, wagers, side bets, snitch reports and the like.
-- One table of small JSON records; `kind` says which, the typed shapes live in src/lib/games.
create table if not exists game_records (
  id text primary key default gen_random_uuid()::text,
  kind text not null,
  profile_id text references profiles (id) on delete cascade,
  status text not null default 'open',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_records_kind_idx on game_records (kind, created_at desc);
