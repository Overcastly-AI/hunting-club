-- Invite redemption (SPEC "Setting up a club", step 4): scanning the Club QR code joins
-- the mesh offline; when online, the invite token adds the user to club_members and
-- enforces the plan's member limit. Everything below runs in one transaction with the
-- invite and club rows locked, so concurrent redemptions cannot exceed limits.

-- The one definition of which Stripe statuses keep a club's features unlocked.
-- past_due is the grace period before cancellation (SPEC "When a subscription lapses").
create function private.is_entitled_status(status public.subscription_status) returns boolean
language sql immutable
set search_path = ''
as $$
  select status in ('trialing', 'active', 'past_due')
$$;


-- Error codes the RPC raises (SQLSTATE P0001, message = label). An enum so clients get
-- the list from the generated types instead of a hand-copied one.
create type public.redeem_invite_error as enum (
  'not_authenticated',
  'invite_not_found',
  'invite_expired',
  'invite_used_up',
  'club_inactive',
  'club_full'
);

create function private.raise_redeem_error(code public.redeem_invite_error) returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = code::text;
end;
$$;

create function public.redeem_invite(
  invite_token text,
  display_name text,
  initials text
)
returns public.club_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  inv public.invites;
  existing public.club_members;
  sub public.subscriptions;
  limit_for_plan integer;
  active_members integer;
  joined public.club_members;
begin
  if caller is null then
    perform private.raise_redeem_error('not_authenticated');
  end if;

  select * into inv from public.invites i where i.token = invite_token for update;
  if not found then
    perform private.raise_redeem_error('invite_not_found');
  end if;

  -- Already in the club: idempotent, consumes no use. Re-scanning must be harmless.
  select * into existing from public.club_members m
  where m.club_id = inv.club_id and m.user_id = caller;
  if found and (existing.expires_at is null or existing.expires_at > now()) then
    return existing;
  end if;

  if inv.expires_at <= now() then
    perform private.raise_redeem_error('invite_expired');
  end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then
    perform private.raise_redeem_error('invite_used_up');
  end if;

  -- Serialise redemptions per club so the member count below stays accurate.
  perform 1 from public.clubs c where c.id = inv.club_id for update;

  select * into sub from public.subscriptions s where s.club_id = inv.club_id;
  if not found or not private.is_entitled_status(sub.status) then
    perform private.raise_redeem_error('club_inactive');
  end if;

  -- Guests (expiring passes) don't count toward the plan's member limit.
  if inv.role <> 'guest' then
    select p.member_limit into limit_for_plan from public.plans p where p.id = sub.plan_id;
    select count(*) into active_members from public.club_members m
    where m.club_id = inv.club_id
      and m.role <> 'guest'
      and (m.expires_at is null or m.expires_at > now());
    if limit_for_plan is not null and active_members >= limit_for_plan then
      perform private.raise_redeem_error('club_full');
    end if;
  end if;

  if existing.id is not null then
    -- An expired guest pass being renewed by a new invite.
    update public.club_members m
    set role = inv.role,
        expires_at = inv.member_expires_at,
        display_name = redeem_invite.display_name,
        initials = redeem_invite.initials
    where m.id = existing.id
    returning * into joined;
  else
    insert into public.club_members (club_id, user_id, display_name, initials, role, expires_at)
    values (inv.club_id, caller, redeem_invite.display_name, redeem_invite.initials,
            inv.role, inv.member_expires_at)
    returning * into joined;
  end if;

  update public.invites i set uses = i.uses + 1 where i.id = inv.id;

  return joined;
end;
$$;

comment on function public.redeem_invite(text, text, text) is
  'Joins the caller to the invite''s club. Errors: SQLSTATE P0001 with a redeem_invite_error label as the message.';

revoke all on function public.redeem_invite(text, text, text) from public, anon;
grant execute on function public.redeem_invite(text, text, text) to authenticated;
