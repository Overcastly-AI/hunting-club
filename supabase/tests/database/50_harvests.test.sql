-- RLS: harvests are the hunter's own; the club sees them only while shared.
begin;
\ir ../../scripts/test-helpers.sql
select plan(14);
select tests.seed_two_clubs();
select tests.add_member(tests.club_id('Pine Hollow'), 'max');  -- max is in both clubs
select tests.create_harvest(tests.club_id('Oak Ridge'), 'max', true);
select tests.create_harvest(tests.club_id('Oak Ridge'), 'gus', false);
select tests.create_harvest(tests.club_id('Pine Hollow'), 'pat', true);

select tests.authenticate_as('gus');
select is((select count(*) from public.harvests), 2::bigint,
  'a hunter sees their own unshared harvest plus the club''s shared ones');

select tests.authenticate_as('max');
select results_eq(
  $$select h.club_id from public.harvests h order by h.club_id = tests.club_id('Oak Ridge') desc$$,
  array[tests.club_id('Oak Ridge'), tests.club_id('Pine Hollow')],
  'a member of two clubs sees shared harvests from both, and not gus''s private one'
);
select is(tests.affected_rows($$update public.harvests set notes = 'nice' where sex = 'male'
                                and member_id <> tests.member_id(tests.club_id('Oak Ridge'), 'max')$$),
  0::bigint, 'a hunter cannot edit someone else''s harvest');
select throws_ok(
  $$insert into public.harvests (club_id, member_id, species, harvested_at)
    values (tests.club_id('Oak Ridge'), tests.member_id(tests.club_id('Oak Ridge'), 'gus'), 'doe', now())$$,
  '42501', null, 'a hunter cannot log a harvest as someone else'
);
select lives_ok(
  $$insert into public.harvests (club_id, member_id, species, sex, harvested_at, shared)
    values (tests.club_id('Oak Ridge'), tests.member_id(tests.club_id('Oak Ridge'), 'max'),
            'turkey', 'male', now(), true)$$,
  'a hunter shares a harvest with their club'
);
select is(tests.affected_rows($$update public.harvests set shared = false
                                where member_id = tests.member_id(tests.club_id('Oak Ridge'), 'max')$$),
  2::bigint, 'a hunter withdraws their shares');

select tests.authenticate_as('gus');
select is((select count(*) from public.harvests), 1::bigint,
  'unshared harvests disappear for the rest of the club');

select tests.authenticate_as('nora');
select is_empty($$select 1 from public.harvests$$, 'a user in no club sees no harvests');
select throws_ok(
  $$insert into public.harvests (club_id, member_id, species, harvested_at)
    values (tests.club_id('Oak Ridge'), tests.member_id(tests.club_id('Oak Ridge'), 'max'), 'doe', now())$$,
  '42501', null, 'a non-member cannot log harvests in a club'
);

select tests.authenticate_as('eve');
select is_empty($$select 1 from public.harvests$$, 'an expired guest sees no harvests');

select tests.authenticate_as('pat');
select is((select count(*) from public.harvests where club_id = tests.club_id('Oak Ridge')), 0::bigint,
  'another club''s admin sees none of this club''s harvests');

select tests.clear_authentication();
select tests.create_harvest(tests.club_id('Oak Ridge'), 'gus', true);
select tests.authenticate_as('ada');
select is(tests.affected_rows($$delete from public.harvests where shared and member_id =
                                tests.member_id(tests.club_id('Oak Ridge'), 'gus')$$),
  1::bigint, 'an admin can remove a member''s shared harvest (moderation)');
select is(tests.affected_rows($$delete from public.harvests where member_id =
                                tests.member_id(tests.club_id('Oak Ridge'), 'gus')$$),
  0::bigint, 'an admin cannot see or touch a member''s private harvest');

select tests.authenticate_as_anon();
select throws_ok($$select 1 from public.harvests$$, '42501', null,
  'anonymous users cannot read harvests');

select * from finish();
rollback;
