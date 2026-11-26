-- Shared pgTAP fixtures and helpers for supabase/tests/database/*.test.sql.
-- Included by each test file with \ir (works under pg_prove and `supabase test db`);
-- runs inside the test transaction, so nothing persists. Never a migration.
-- Every test file builds its world with these functions instead of hand-written inserts.

create extension if not exists pgtap;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Users -----------------------------------------------------------------------

create or replace function tests.create_user(username text) returns uuid
language sql security definer
set search_path = ''
as $$
  insert into auth.users (email) values (username || '@test.huntclub') returning id
$$;

create or replace function tests.user_id(username text) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from auth.users where email = username || '@test.huntclub'
$$;

-- Acting as a role ------------------------------------------------------------
-- These switch role for the rest of the current transaction, like a PostgREST request.

create or replace function tests.authenticate_as(username text) returns void
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := tests.user_id(username);
begin
  if uid is null then
    raise exception 'tests.authenticate_as: unknown user %', username;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.authenticate_as_anon() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.authenticate_as_service_role() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  perform set_config('role', 'service_role', true);
end;
$$;

-- Back to the test runner's own (superuser) role for building fixtures.
create or replace function tests.clear_authentication() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'none', true);
end;
$$;

-- Runs a DML statement as the current role and returns how many rows it touched.
-- Lets tests assert "RLS silently filtered this update/delete to 0 rows".
create or replace function tests.affected_rows(statement text) returns bigint
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Clubs -----------------------------------------------------------------------

-- A provisioned club (what the webhook Lambda creates): club row, subscription
-- on the given plan/status, and an admin membership for admin_username.
create or replace function tests.create_club(
  club_name text,
  admin_username text,
  plan text default 'club_standard',
  status public.subscription_status default 'active'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  cid uuid;
  admin_uid uuid := coalesce(tests.user_id(admin_username), tests.create_user(admin_username));
begin
  insert into public.clubs (name, created_by) values (club_name, admin_uid) returning id into cid;
  insert into public.subscriptions (club_id, stripe_customer_id, stripe_subscription_id, plan_id, status)
  values (cid, 'cus_' || cid, 'sub_' || cid, plan, status);
  insert into public.club_members (club_id, user_id, display_name, initials, role)
  values (cid, admin_uid, admin_username, upper(left(admin_username, 2)), 'admin');
  return cid;
end;
$$;

-- Adds a user (created if needed) to a club; returns the club_members.id.
create or replace function tests.add_member(
  club uuid,
  username text,
  member_role public.member_role default 'member',
  expires timestamptz default null
) returns uuid
language sql security definer
set search_path = ''
as $$
  insert into public.club_members (club_id, user_id, display_name, initials, role, expires_at)
  values (club, coalesce(tests.user_id(username), tests.create_user(username)), username,
          upper(left(username, 2)), member_role, expires)
  returning id
$$;

create or replace function tests.member_id(club uuid, username text) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select m.id from public.club_members m
  where m.club_id = club and m.user_id = tests.user_id(username)
$$;

create or replace function tests.create_area(club uuid, area_name text) returns uuid
language sql security definer
set search_path = ''
as $$
  insert into public.areas (club_id, name, boundary)
  values (club, area_name,
          '{"type":"Polygon","coordinates":[[[-90,40],[-90,40.01],[-89.99,40.01],[-90,40]]]}')
  returning id
$$;

create or replace function tests.create_stand(club uuid, stand_name text, area uuid default null)
returns uuid
language sql security definer
set search_path = ''
as $$
  insert into public.stands (club_id, area_id, name, type, lat, lon)
  values (club, area, stand_name, 'tree_stand', 40.005, -89.995)
  returning id
$$;

create or replace function tests.create_harvest(club uuid, username text, is_shared boolean)
returns uuid
language sql security definer
set search_path = ''
as $$
  insert into public.harvests (club_id, member_id, species, sex, harvested_at, shared)
  values (club, tests.member_id(club, username), 'whitetail', 'male', now(), is_shared)
  returning id
$$;

create or replace function tests.create_invite(
  club uuid,
  invite_role public.member_role default 'member',
  expires timestamptz default now() + interval '7 days',
  uses_allowed integer default null,
  pass_expires timestamptz default null
) returns text
language sql security definer
set search_path = ''
as $$
  insert into public.invites (club_id, role, expires_at, max_uses, member_expires_at)
  values (club, invite_role, expires, uses_allowed, pass_expires)
  returning token
$$;

-- A standard world used by most RLS tests:
--   club "Oak Ridge": admin "ada", member "max", guest "gus" (valid pass),
--                     expired guest "eve", area "North 40", stand "Creek Stand"
--   club "Pine Hollow": admin "pat" (an outsider to Oak Ridge)
--   "nora": signed-in user in no club
create or replace function tests.seed_two_clubs() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  oak uuid := tests.create_club('Oak Ridge', 'ada');
  pine uuid := tests.create_club('Pine Hollow', 'pat');
begin
  perform tests.add_member(oak, 'max');
  perform tests.add_member(oak, 'gus', 'guest', now() + interval '1 day');
  perform tests.add_member(oak, 'eve', 'guest', now() - interval '1 day');
  perform tests.create_stand(oak, 'Creek Stand', tests.create_area(oak, 'North 40'));
  perform tests.create_stand(pine, 'Ridge Ladder');
  perform tests.create_user('nora');
  insert into public.club_secrets (club_id, channel_key) values
    (oak, decode(repeat('ab', 32), 'hex')),
    (pine, decode(repeat('cd', 32), 'hex'));
end;
$$;

create or replace function tests.club_id(club_name text) returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.clubs where name = club_name
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;
