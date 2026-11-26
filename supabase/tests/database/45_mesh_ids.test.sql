-- Radio ids (mesh_id) for stands and areas: server-assigned, per club, never reused.
begin;
\ir ../../scripts/test-helpers.sql
select plan(10);
select tests.seed_two_clubs();

select tests.authenticate_as('ada');
insert into public.stands (club_id, name, type, lat, lon, mesh_id)
values (tests.club_id('Oak Ridge'), 'Spoofed', 'ladder', 40, -90, 999);
insert into public.stands (club_id, name, type, lat, lon)
values (tests.club_id('Oak Ridge'), 'Third', 'ground_blind', 40, -90);

select results_eq(
  $$select mesh_id from public.stands where club_id = tests.club_id('Oak Ridge') order by mesh_id$$,
  array[1::bigint, 2, 3],
  'stands get sequential ids starting at 1, and a client-supplied mesh_id is ignored');
select is((select mesh_id from public.stands where name = 'Spoofed'), 2::bigint,
  'the spoofed value 999 was replaced by the next id');
select is((select mesh_id from public.areas where name = 'North 40'), 1::bigint,
  'areas count separately from stands');

select throws_ok($$update public.stands set mesh_id = 7 where name = 'Third'$$, '42501', null,
  'an admin cannot change a mesh_id');
select throws_ok(
  $$update public.stands set club_id = tests.club_id('Pine Hollow') where name = 'Third'$$,
  '42501', null, 'a stand cannot move to another club');

delete from public.stands where name = 'Third';
insert into public.stands (club_id, name, type, lat, lon)
values (tests.club_id('Oak Ridge'), 'Fourth', 'ladder', 40, -90);
select is((select mesh_id from public.stands where name = 'Fourth'), 4::bigint,
  'a deleted stand''s id is never reused');

select tests.authenticate_as('pat');
select results_eq($$select mesh_id from public.stands$$, array[1::bigint],
  'each club has its own sequence');

select tests.authenticate_as('max');
select throws_ok($$select 1 from private.mesh_id_counters$$, '42501', null,
  'clients cannot read or touch the counters');

select tests.clear_authentication();
select col_is_unique('public', 'stands', array['club_id', 'mesh_id'],
  'stand mesh_id is unique within a club');
select col_is_unique('public', 'areas', array['club_id', 'mesh_id'],
  'area mesh_id is unique within a club');

select * from finish();
rollback;
