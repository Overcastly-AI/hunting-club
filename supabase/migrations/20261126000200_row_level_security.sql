-- Row-level security for every table in 20261126000100_club_schema.sql.
--
-- Who can do what:
--   members (incl. unexpired guests): read their own club's rows
--   admins: write stands, areas, invites and the roster; read and write club_secrets
--   service role (webhook / provisioning Lambdas): bypasses RLS; the only writer of
--     clubs, subscriptions, map_packs, plans and stripe_events
--   harvests: the hunter's own rows always; other members only while shared
--
-- Every policy uses the two helpers below; no policy repeats membership logic.

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies on club_members don't recurse)
-- ---------------------------------------------------------------------------

-- The single definition of "an active member of this club with at least this role".
create function private.has_club_role(target_club_id uuid, allowed public.member_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members m
    where m.club_id = target_club_id
      and m.user_id = (select auth.uid())
      and m.role = any (allowed)
      and (m.expires_at is null or m.expires_at > now())
  )
$$;

create function private.is_club_member(target_club_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select private.has_club_role(target_club_id, enum_range(null::public.member_role))
$$;

create function private.is_club_admin(target_club_id uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select private.has_club_role(target_club_id, array['admin']::public.member_role[])
$$;

revoke all on function private.has_club_role(uuid, public.member_role[]) from public;
grant execute on function private.has_club_role(uuid, public.member_role[])
  to authenticated, service_role;
grant execute on function private.is_club_member(uuid) to authenticated, service_role;
grant execute on function private.is_club_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere; anonymous users get nothing except the plan list
-- ---------------------------------------------------------------------------

alter table public.plans enable row level security;
alter table public.clubs enable row level security;
alter table public.club_secrets enable row level security;
alter table public.club_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invites enable row level security;
alter table public.areas enable row level security;
alter table public.stands enable row level security;
alter table public.harvests enable row level security;
alter table public.map_packs enable row level security;
alter table public.stripe_events enable row level security;

revoke all on
  public.clubs, public.club_secrets, public.club_members, public.subscriptions,
  public.invites, public.areas, public.stands, public.harvests, public.map_packs,
  public.stripe_events
from anon;
revoke insert, update, delete, truncate on public.plans from anon, authenticated;
revoke all on public.stripe_events from authenticated;

-- ---------------------------------------------------------------------------
-- plans: public price list (web checkout page shows it before sign-in)
-- ---------------------------------------------------------------------------

create policy "Anyone can read active plans" on public.plans
  for select to anon, authenticated
  using (active);

-- ---------------------------------------------------------------------------
-- clubs: created by the provisioning Lambda (service role)
-- ---------------------------------------------------------------------------

create policy "Members read their club" on public.clubs
  for select to authenticated
  using (private.is_club_member(id));

create policy "Admins update their club" on public.clubs
  for update to authenticated
  using (private.is_club_admin(id))
  with check (private.is_club_admin(id));

-- ---------------------------------------------------------------------------
-- club_secrets: admins only
-- ---------------------------------------------------------------------------

create policy "Admins read the club key" on public.club_secrets
  for select to authenticated
  using (private.is_club_admin(club_id));

create policy "Admins create the club key" on public.club_secrets
  for insert to authenticated
  with check (private.is_club_admin(club_id));

create policy "Admins reset the club key" on public.club_secrets
  for update to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- club_members: members read the roster; admins manage it; members edit their
-- own profile fields (guarded by trigger below) and may leave.
-- ---------------------------------------------------------------------------

create policy "Members read the roster" on public.club_members
  for select to authenticated
  using (private.is_club_member(club_id));

create policy "Admins add members" on public.club_members
  for insert to authenticated
  with check (private.is_club_admin(club_id));

create policy "Admins and the member update a membership" on public.club_members
  for update to authenticated
  using (private.is_club_admin(club_id) or user_id = (select auth.uid()))
  with check (private.is_club_admin(club_id) or user_id = (select auth.uid()));

create policy "Admins remove members; members leave" on public.club_members
  for delete to authenticated
  using (private.is_club_admin(club_id) or user_id = (select auth.uid()));

-- Non-admins may only change their own profile fields (name, initials, radio).
create function private.guard_club_member_update() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.club_id, new.user_id) is distinct from (old.club_id, old.user_id) then
    raise exception 'club_id and user_id cannot change' using errcode = '42501';
  end if;
  if (new.role, new.expires_at) is distinct from (old.role, old.expires_at)
     and current_user = 'authenticated'
     and not private.is_club_admin(old.club_id) then
    raise exception 'only club admins can change role or expiry' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_update before update on public.club_members
  for each row execute function private.guard_club_member_update();

-- A club always keeps at least one admin (demote/remove/leave).
create function private.keep_one_admin() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and exists (select 1 from public.clubs c where c.id = old.club_id)
     and not exists (
       select 1 from public.club_members m
       where m.club_id = old.club_id and m.role = 'admin' and m.id <> old.id
     ) then
    raise exception 'a club must keep at least one admin' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_one_admin before update or delete on public.club_members
  for each row execute function private.keep_one_admin();

-- ---------------------------------------------------------------------------
-- subscriptions: admins read billing state; only the webhook Lambda writes
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate on public.subscriptions from authenticated;

create policy "Admins read the subscription" on public.subscriptions
  for select to authenticated
  using (private.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- invites: admins only (members redeem through public.redeem_invite)
-- ---------------------------------------------------------------------------

create policy "Admins manage invites" on public.invites
  for all to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- areas and stands: members read, admins write
-- ---------------------------------------------------------------------------

create policy "Members read areas" on public.areas
  for select to authenticated
  using (private.is_club_member(club_id));

create policy "Admins manage areas" on public.areas
  for all to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));

create policy "Members read stands" on public.stands
  for select to authenticated
  using (private.is_club_member(club_id));

create policy "Admins manage stands" on public.stands
  for all to authenticated
  using (private.is_club_admin(club_id))
  with check (private.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- harvests: own rows always; the club sees them only while shared
-- ---------------------------------------------------------------------------

create function private.is_own_membership(target_member_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
    where m.id = target_member_id
      and m.user_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  )
$$;
revoke all on function private.is_own_membership(uuid) from public;
grant execute on function private.is_own_membership(uuid) to authenticated, service_role;

create policy "Hunters read their own harvests; members read shared ones" on public.harvests
  for select to authenticated
  using (
    private.is_own_membership(member_id)
    or (shared and private.is_club_member(club_id))
  );

create policy "Hunters log their own harvests" on public.harvests
  for insert to authenticated
  with check (private.is_own_membership(member_id));

create policy "Hunters edit their own harvests" on public.harvests
  for update to authenticated
  using (private.is_own_membership(member_id))
  with check (private.is_own_membership(member_id));

create policy "Hunters delete their own harvests; admins moderate" on public.harvests
  for delete to authenticated
  using (private.is_own_membership(member_id) or private.is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- map_packs: members read; the map-pack Lambda (service role) writes
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate on public.map_packs from authenticated;

create policy "Members read map packs" on public.map_packs
  for select to authenticated
  using (private.is_club_member(club_id));

-- clubs: no insert/delete policies, so only the service role can create or delete.
revoke insert, delete, truncate on public.clubs from authenticated;
-- stripe_events: RLS on, no policies, no grants: service role only.
