-- public.redeem_invite: expiry, use count, plan member limit, idempotency.
begin;
\ir ../../scripts/test-helpers.sql
select plan(21);
select tests.seed_two_clubs();
insert into public.plans (id, name, member_limit) values ('tiny_test_plan', 'Tiny', 3);
select tests.create_club('Small Camp', 'sid', 'tiny_test_plan');
select tests.add_member(tests.club_id('Small Camp'), 'sal');  -- 2 of 3 seats taken
select tests.create_club('Lapsed Lodge', 'lou', status => 'canceled');
select tests.create_user(u) from unnest(array['hal', 'ivy', 'jo', 'kim', 'lee', 'mo']) u;

create temp table tokens (name text primary key, token text not null);
grant select on tokens to authenticated, anon;
insert into tokens values
  ('oak', tests.create_invite(tests.club_id('Oak Ridge'))),
  ('expired', tests.create_invite(tests.club_id('Oak Ridge'), expires => now() - interval '1 minute')),
  ('single', tests.create_invite(tests.club_id('Oak Ridge'), uses_allowed => 1)),
  ('small', tests.create_invite(tests.club_id('Small Camp'))),
  ('small_guest', tests.create_invite(tests.club_id('Small Camp'), 'guest',
                                      pass_expires => now() + interval '2 days')),
  ('lapsed', tests.create_invite(tests.club_id('Lapsed Lodge'))),
  ('oak_guest_renewal', tests.create_invite(tests.club_id('Oak Ridge'), 'guest',
                                            pass_expires => now() + interval '5 days'));

-- Happy path -----------------------------------------------------------------------

select tests.authenticate_as('hal');
select is(
  (select role::text from public.redeem_invite((select token from tokens where name = 'oak'), 'Hal', 'HB')),
  'member', 'a valid invite joins the club as a member');
select results_eq($$select name from public.stands$$, array['Creek Stand'],
  'the new member can immediately read the club''s stands');
select lives_ok(
  $$select public.redeem_invite((select token from tokens where name = 'oak'), 'Hal', 'HB')$$,
  're-scanning an invite you already used is harmless');

select tests.clear_authentication();
select is((select uses from public.invites where token = (select token from tokens where name = 'oak')),
  1, 'a repeat redemption by an existing member consumes no use');

-- Failures ---------------------------------------------------------------------------

select tests.authenticate_as('ivy');
select throws_ok($$select public.redeem_invite('not-a-real-token', 'Ivy', 'IV')$$,
  'P0001', 'invite_not_found', 'an unknown token is rejected');
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'expired'), 'Ivy', 'IV')$$,
  'P0001', 'invite_expired', 'an expired invite is rejected');
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'lapsed'), 'Ivy', 'IV')$$,
  'P0001', 'club_inactive', 'a club with a canceled subscription admits no one');

select lives_ok(
  $$select public.redeem_invite((select token from tokens where name = 'single'), 'Ivy', 'IV')$$,
  'a single-use invite works once');
select tests.authenticate_as('jo');
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'single'), 'Jo', 'JO')$$,
  'P0001', 'invite_used_up', 'a used-up invite is rejected');

-- Member limit (Small Camp: plan limit 3, two seats taken) -----------------------------

select lives_ok(
  $$select public.redeem_invite((select token from tokens where name = 'small'), 'Jo', 'JO')$$,
  'the last seat can be taken');
select tests.authenticate_as('kim');
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'small'), 'Kim', 'KM')$$,
  'P0001', 'club_full', 'a full club rejects new members');
select is(
  (select role::text from public.redeem_invite((select token from tokens where name = 'small_guest'), 'Kim', 'KM')),
  'guest', 'guest passes do not count toward the member limit');
select tests.clear_authentication();
select isnt((select expires_at from public.club_members
             where user_id = tests.user_id('kim')), null,
  'a guest membership expires');
select is((select count(*) from public.club_members
           where club_id = tests.club_id('Small Camp') and role <> 'guest'), 3::bigint,
  'the club holds exactly its plan limit');

-- An expired guest renews with a new guest invite ------------------------------------------

select tests.authenticate_as('eve');
select is(
  (select expires_at > now() from public.redeem_invite(
     (select token from tokens where name = 'oak_guest_renewal'), 'Eve', 'EV')),
  true, 'an expired guest renews their pass with a new invite');
select tests.clear_authentication();
select is((select count(*) from public.club_members where user_id = tests.user_id('eve')), 1::bigint,
  'renewal updates the existing membership instead of adding a second one');

-- Who may call it ----------------------------------------------------------------------------

select tests.clear_authentication();
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'oak'), 'Nobody', 'NB')$$,
  'P0001', 'not_authenticated', 'a request without a user id is rejected');

select tests.authenticate_as_anon();
select throws_ok(
  $$select public.redeem_invite((select token from tokens where name = 'oak'), 'Anon', 'AN')$$,
  '42501', null, 'anonymous users cannot redeem invites');

select tests.clear_authentication();
select is(
  (select array_agg(grantee::text order by grantee::text)
   from information_schema.role_routine_grants
   where routine_name = 'redeem_invite' and privilege_type = 'EXECUTE'
     and grantee in ('anon', 'authenticated', 'service_role')),
  array['authenticated', 'service_role'],
  'anon has no execute on redeem_invite (service_role has no auth.uid, so it is rejected)');

-- Concurrency: the function locks the invite and the club row.
select ok(
  (select prosecdef from pg_proc where oid = 'public.redeem_invite(text, text, text)'::regprocedure),
  'redeem_invite runs as security definer (atomic checks bypass caller RLS)');
select is(
  (select proconfig from pg_proc where oid = 'public.redeem_invite(text, text, text)'::regprocedure),
  array['search_path=""'], 'redeem_invite pins an empty search_path');

select * from finish();
rollback;
