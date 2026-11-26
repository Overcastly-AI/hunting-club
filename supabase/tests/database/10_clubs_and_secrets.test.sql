-- RLS: clubs and club_secrets.
begin;
\ir ../../scripts/test-helpers.sql
select plan(16);
select tests.seed_two_clubs();

-- clubs ------------------------------------------------------------------------

select tests.authenticate_as('max');
select results_eq($$select name from public.clubs$$, array['Oak Ridge'],
  'a member sees only their own club');
select is(tests.affected_rows($$update public.clubs set name = 'Max Ridge'$$), 0::bigint,
  'a member cannot rename the club');
select throws_ok($$insert into public.clubs (name) values ('Rogue Club')$$, '42501', null,
  'a member cannot create clubs (provisioning Lambda only)');

select tests.authenticate_as('ada');
select is(tests.affected_rows(
  $$update public.clubs set overdue_grace_minutes = 45 where name = 'Oak Ridge'$$), 1::bigint,
  'an admin updates their club');
select is(tests.affected_rows($$update public.clubs set name = 'Mine' where name = 'Pine Hollow'$$),
  0::bigint, 'an admin cannot update another club');
select throws_ok($$delete from public.clubs where name = 'Oak Ridge'$$, '42501', null,
  'an admin cannot delete the club (service role only)');

select tests.authenticate_as('nora');
select is_empty($$select 1 from public.clubs$$, 'a signed-in non-member sees no clubs');

select tests.authenticate_as('eve');
select is_empty($$select 1 from public.clubs$$, 'an expired guest sees no clubs');

select tests.authenticate_as_anon();
select throws_ok($$select 1 from public.clubs$$, '42501', null, 'anonymous users cannot read clubs');

-- club_secrets -----------------------------------------------------------------

select tests.authenticate_as('ada');
select results_eq($$select octet_length(channel_key) from public.club_secrets$$, array[32],
  'an admin reads their own club''s key and no other');
select is(tests.affected_rows(
  $$update public.club_secrets set channel_key = decode(repeat('ef', 32), 'hex'),
                                   key_version = key_version + 1$$), 1::bigint,
  'an admin resets their club''s key');

select tests.authenticate_as('max');
select is_empty($$select 1 from public.club_secrets$$, 'a member cannot read the club key');
select is(tests.affected_rows(
  $$update public.club_secrets set channel_key = decode(repeat('00', 32), 'hex')$$), 0::bigint,
  'a member cannot change the club key');

select tests.authenticate_as('gus');
select is_empty($$select 1 from public.club_secrets$$, 'a guest cannot read the club key');

select tests.authenticate_as('pat');
select throws_ok(
  $$insert into public.club_secrets (club_id, channel_key)
    values (tests.club_id('Oak Ridge'), decode(repeat('11', 32), 'hex'))
    on conflict (club_id) do update set channel_key = excluded.channel_key$$,
  '42501', null, 'another club''s admin cannot write this club''s key');

select tests.authenticate_as_service_role();
select is((select count(*) from public.club_secrets), 2::bigint,
  'the service role reads every key (Lambdas)');

select * from finish();
rollback;
