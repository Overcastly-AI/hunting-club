-- RLS: invites (admin only), areas and stands (members read, admins write).
begin;
\ir ../../scripts/test-helpers.sql
select plan(19);
select tests.seed_two_clubs();
select tests.create_invite(tests.club_id('Oak Ridge'));

-- invites -----------------------------------------------------------------------

select tests.authenticate_as('ada');
select is((select count(*) from public.invites), 1::bigint, 'an admin reads their club''s invites');
select lives_ok(
  $$insert into public.invites (club_id, role, expires_at, member_expires_at)
    values (tests.club_id('Oak Ridge'), 'guest', now() + interval '1 day', now() + interval '3 days')$$,
  'an admin creates a guest pass invite');
select is(tests.affected_rows($$delete from public.invites where role = 'guest'$$), 1::bigint,
  'an admin revokes an invite');

select tests.authenticate_as('max');
select is_empty($$select 1 from public.invites$$, 'a member cannot read invite tokens');
select throws_ok(
  $$insert into public.invites (club_id, expires_at) values (tests.club_id('Oak Ridge'), now() + interval '1 day')$$,
  '42501', null, 'a member cannot create invites');

select tests.authenticate_as('pat');
select is_empty($$select 1 from public.invites where club_id = tests.club_id('Oak Ridge')$$,
  'another club''s admin cannot read these invites');

-- areas --------------------------------------------------------------------------

select tests.authenticate_as('max');
select results_eq($$select name from public.areas$$, array['North 40'],
  'a member reads their club''s areas');
select throws_ok(
  $$insert into public.areas (club_id, name, boundary)
    values (tests.club_id('Oak Ridge'), 'Creek Bottom',
            '{"type":"Polygon","coordinates":[[[-90,40],[-90,40.01],[-89.99,40.01],[-90,40]]]}')$$,
  '42501', null, 'a member cannot add areas');
select is(tests.affected_rows($$update public.areas set name = 'Max''s 40'$$), 0::bigint,
  'a member cannot rename areas');

select tests.authenticate_as('ada');
select lives_ok(
  $$insert into public.areas (club_id, name, boundary)
    values (tests.club_id('Oak Ridge'), 'Creek Bottom',
            '{"type":"Polygon","coordinates":[[[-90,40],[-90,40.01],[-89.99,40.01],[-90,40]]]}')$$,
  'an admin adds an area');

select tests.authenticate_as('eve');
select is_empty($$select 1 from public.areas$$, 'an expired guest sees no areas');

-- stands -------------------------------------------------------------------------

select tests.authenticate_as('gus');
select results_eq($$select name from public.stands$$, array['Creek Stand'],
  'a guest reads their club''s stands only');

select tests.authenticate_as('max');
select throws_ok(
  $$insert into public.stands (club_id, name, type, lat, lon)
    values (tests.club_id('Oak Ridge'), 'My Stand', 'ladder', 40, -90)$$,
  '42501', null, 'a member cannot add stands');
select is(tests.affected_rows($$update public.stands set active = false$$), 0::bigint,
  'a member cannot change stands');
select is(tests.affected_rows($$delete from public.stands$$), 0::bigint,
  'a member cannot delete stands');

select tests.authenticate_as('ada');
select lives_ok(
  $$insert into public.stands (club_id, name, type, lat, lon)
    values (tests.club_id('Oak Ridge'), 'Field Blind', 'ground_blind', 40.002, -89.998)$$,
  'an admin adds a stand');
select is(tests.affected_rows($$update public.stands set notes = 'Moved' where name = 'Ridge Ladder'$$),
  0::bigint, 'an admin cannot edit another club''s stands');
select throws_ok(
  $$insert into public.stands (club_id, name, type, lat, lon)
    values (tests.club_id('Pine Hollow'), 'Planted', 'ladder', 40, -90)$$,
  '42501', null, 'an admin cannot add stands to another club');

select tests.authenticate_as('nora');
select is_empty($$select 1 from public.stands$$, 'a user in no club sees no stands');

select * from finish();
rollback;
