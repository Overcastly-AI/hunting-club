-- Club cloud schema (docs/SPEC.md, "Clubs and subscriptions" → "Cloud tables").
-- One shared database: every club-owned row carries club_id and is fenced by RLS
-- (see 20261126000200_row_level_security.sql). Free users never touch this database.

-- Helpers that must not be callable through the API live in schema "private",
-- which PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums (single source of truth; TypeScript types are generated from these)
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('admin', 'member', 'guest');

create type public.stand_type as enum ('tree_stand', 'ladder', 'ground_blind');

create type public.harvest_sex as enum ('male', 'female', 'unknown');

-- Mirrors Stripe's subscription.status values; written only by the webhook Lambda.
create type public.subscription_status as enum (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'canceled',
  'paused'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current (last-write-wins sync relies on it)
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attaches the updated_at trigger to a table; used once per table below.
create function private.track_updated_at(target regclass) returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger set_updated_at before update on %s
       for each row execute function private.set_updated_at()',
    target
  );
end;
$$;

-- Reusable value checks.
create function private.is_geojson_polygon(value jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select value is null
      or (jsonb_typeof(value) = 'object'
          and value ->> 'type' in ('Polygon', 'MultiPolygon')
          and jsonb_typeof(value -> 'coordinates') = 'array')
$$;

create function private.is_valid_lat_lon(lat double precision, lon double precision)
returns boolean
language sql immutable
set search_path = ''
as $$
  select (lat is null and lon is null)
      or (lat between -90 and 90 and lon between -180 and 180)
$$;

-- ---------------------------------------------------------------------------
-- Plans (config). Member limits are an OPEN DECISION in docs/SPEC.md
-- ("Club member limits per plan"). The rows inserted below are PLACEHOLDERS.
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (length(name) between 1 and 60),
  -- Maximum non-guest members (admins + members). Null = unlimited.
  member_limit integer check (member_limit is null or member_limit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.plans is
  'Club subscription plans. member_limit values are placeholders until the owner decides (SPEC open decision 2).';
select private.track_updated_at('public.plans');

-- PLACEHOLDER values: replace when SPEC open decision 2 is made.
insert into public.plans (id, name, member_limit) values
  ('club_standard', 'Club (placeholder)', 50);

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  acreage numeric(10, 2) check (acreage is null or acreage >= 0),
  boundary jsonb check (private.is_geojson_polygon(boundary)),
  -- Meshtastic LoRa region code, e.g. 'US'.
  region text not null default 'US' check (region ~ '^[A-Z0-9_]{2,12}$'),
  overdue_grace_minutes integer not null default 30
    check (overdue_grace_minutes between 0 and 720),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select private.track_updated_at('public.clubs');

-- The club's mesh channel key. Readable by that club's admins only.
create table public.club_secrets (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  -- 256-bit Meshtastic channel PSK. Never log this value.
  channel_key bytea not null check (octet_length(channel_key) = 32),
  key_version integer not null default 1 check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select private.track_updated_at('public.club_secrets');

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  initials text not null check (initials ~ '^[[:alnum:]]{1,3}$'),
  role public.member_role not null default 'member',
  -- Meshtastic node number (uint32).
  node_id bigint check (node_id between 0 and 4294967295),
  -- Guest passes expire; admins and members normally don't.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id),
  unique (id, club_id),
  check (role <> 'admin' or expires_at is null)
);
create index club_members_user_id_idx on public.club_members (user_id);
select private.track_updated_at('public.club_members');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null unique references public.clubs (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null,
  paid_through timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select private.track_updated_at('public.subscriptions');

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  -- Random 256-bit token carried in the Club QR code / invite link.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    check (length(token) >= 32),
  role public.member_role not null default 'member' check (role <> 'admin'),
  -- For guest passes: when the resulting membership expires.
  member_expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_uses is null or uses <= max_uses),
  check (role = 'guest' or member_expires_at is null)
);
select private.track_updated_at('public.invites');

-- Optional named zones ("North 40", "Creek Bottom").
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  boundary jsonb not null check (private.is_geojson_polygon(boundary)),
  notes text check (length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, club_id)
);
select private.track_updated_at('public.areas');

create table public.stands (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  area_id uuid,
  name text not null check (length(btrim(name)) between 1 and 60),
  type public.stand_type not null,
  lat double precision not null,
  lon double precision not null,
  notes text check (length(notes) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, club_id),
  check (private.is_valid_lat_lon(lat, lon)),
  -- The area must belong to the same club.
  foreign key (area_id, club_id) references public.areas (id, club_id) on delete set null (area_id)
);
select private.track_updated_at('public.stands');

-- Only harvests a member chose to share with the club live here (SPEC "Cloud tables").
-- "shared" lets the hunter withdraw a share without deleting the record.
create table public.harvests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  member_id uuid not null,
  species text not null check (length(btrim(species)) between 1 and 40),
  sex public.harvest_sex not null default 'unknown',
  lat double precision,
  lon double precision,
  stand_id uuid,
  area_id uuid,
  notes text check (length(notes) <= 500),
  shared boolean not null default true,
  harvested_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (private.is_valid_lat_lon(lat, lon)),
  foreign key (member_id, club_id) references public.club_members (id, club_id) on delete cascade,
  foreign key (stand_id, club_id) references public.stands (id, club_id) on delete set null (stand_id),
  foreign key (area_id, club_id) references public.areas (id, club_id) on delete set null (area_id)
);
select private.track_updated_at('public.harvests');

create table public.map_packs (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  -- [west, south, east, north] in degrees.
  bounds double precision[] not null check (
    cardinality(bounds) = 4
    and bounds[1] between -180 and 180 and bounds[3] between -180 and 180
    and bounds[2] between -90 and 90 and bounds[4] between -90 and 90
    and bounds[2] < bounds[4]
  ),
  min_zoom smallint not null check (min_zoom between 0 and 22),
  max_zoom smallint not null check (max_zoom between 0 and 22),
  source text not null check (length(source) between 1 and 200),
  s3_key text not null check (length(s3_key) between 1 and 1024),
  size_bytes bigint not null check (size_bytes >= 0),
  built_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_zoom <= max_zoom)
);
select private.track_updated_at('public.map_packs');

-- Stripe webhook idempotency. Service role only.
create table public.stripe_events (
  event_id text primary key check (event_id ~ '^evt_'),
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes on club_id (RLS filters on it for every query)
-- ---------------------------------------------------------------------------

create index club_members_club_id_idx on public.club_members (club_id);
create index invites_club_id_idx on public.invites (club_id);
create index areas_club_id_idx on public.areas (club_id);
create index stands_club_id_idx on public.stands (club_id);
create index stands_area_id_idx on public.stands (area_id);
create index harvests_club_id_idx on public.harvests (club_id);
create index harvests_member_id_idx on public.harvests (member_id);
create index map_packs_club_id_idx on public.map_packs (club_id);
