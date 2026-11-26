-- RLS: plans, subscriptions, stripe_events and map_packs (service-role-written tables).
begin;
\ir ../../scripts/test-helpers.sql
select plan(17);
select tests.seed_two_clubs();
insert into public.map_packs (club_id, bounds, min_zoom, max_zoom, source, s3_key, size_bytes)
values (tests.club_id('Oak Ridge'), array[-90, 40, -89.9, 40.1], 10, 16, 'usgs', 'packs/oak.pmtiles', 1024);
insert into public.plans (id, name, member_limit, active) values ('retired_plan', 'Old', 5, false);

-- plans -------------------------------------------------------------------------

select tests.authenticate_as_anon();
select results_eq($$select id from public.plans$$, array['club_standard'],
  'anyone can read active plans');
select throws_ok($$update public.plans set member_limit = 1000$$, '42501', null,
  'anonymous users cannot change plans');

select tests.authenticate_as('ada');
select throws_ok($$update public.plans set member_limit = 1000$$, '42501', null,
  'admins cannot change plans');

-- subscriptions -----------------------------------------------------------------

select results_eq($$select status::text from public.subscriptions$$, array['active'],
  'an admin reads their own club''s subscription only');
select throws_ok($$update public.subscriptions set status = 'active', paid_through = 'infinity'$$,
  '42501', null, 'an admin cannot edit the subscription');
select throws_ok(
  $$insert into public.subscriptions (club_id, stripe_customer_id, stripe_subscription_id, plan_id, status)
    values (tests.club_id('Oak Ridge'), 'cus_x', 'sub_x', 'club_standard', 'active')$$,
  '42501', null, 'an admin cannot create subscriptions');

select tests.authenticate_as('max');
select is_empty($$select 1 from public.subscriptions$$, 'a member cannot read billing');

select tests.authenticate_as_service_role();
select is(tests.affected_rows($$update public.subscriptions set status = 'past_due'
                                where club_id = tests.club_id('Oak Ridge')$$), 1::bigint,
  'the webhook Lambda (service role) updates subscriptions');

-- stripe_events ------------------------------------------------------------------

select lives_ok($$insert into public.stripe_events (event_id) values ('evt_123')$$,
  'the service role records processed Stripe events');
select throws_ok($$insert into public.stripe_events (event_id) values ('evt_123')$$, '23505', null,
  'a Stripe event is processed at most once');

select tests.authenticate_as('ada');
select throws_ok($$select 1 from public.stripe_events$$, '42501', null,
  'signed-in users cannot read Stripe events');
select throws_ok($$insert into public.stripe_events (event_id) values ('evt_fake')$$, '42501', null,
  'signed-in users cannot write Stripe events');

-- map_packs -----------------------------------------------------------------------

select tests.authenticate_as('max');
select results_eq($$select s3_key from public.map_packs$$, array['packs/oak.pmtiles'],
  'a member reads their club''s map packs');
select throws_ok(
  $$insert into public.map_packs (club_id, bounds, min_zoom, max_zoom, source, s3_key, size_bytes)
    values (tests.club_id('Oak Ridge'), array[-90, 40, -89.9, 40.1], 10, 16, 'usgs', 'x', 1)$$,
  '42501', null, 'members cannot create map packs');

select tests.authenticate_as('ada');
select throws_ok($$delete from public.map_packs$$, '42501', null,
  'admins cannot delete map packs (map-pack Lambda only)');

select tests.authenticate_as('pat');
select is_empty($$select 1 from public.map_packs$$, 'another club cannot see this club''s packs');

select tests.authenticate_as_anon();
select throws_ok($$select 1 from public.map_packs$$, '42501', null,
  'anonymous users cannot read map packs');

select * from finish();
rollback;
