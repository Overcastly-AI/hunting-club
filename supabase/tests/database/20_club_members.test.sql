-- RLS: the roster (club_members), including the role guard and last-admin rule.
begin;
\ir ../../scripts/test-helpers.sql
select plan(17);
select tests.seed_two_clubs();
select tests.create_user('newbie');

select tests.authenticate_as('max');
select results_eq(
  $$select display_name from public.club_members order by display_name$$,
  array['ada', 'eve', 'gus', 'max'],
  'a member reads their club''s roster only'
);
select throws_ok(
  $$insert into public.club_members (club_id, user_id, display_name, initials)
    values (tests.club_id('Oak Ridge'), tests.user_id('newbie'), 'Newbie', 'NB')$$,
  '42501', null, 'a member cannot add members'
);
select is(tests.affected_rows($$update public.club_members set display_name = 'Maxine', node_id = 305419896
                                where display_name = 'max'$$), 1::bigint,
  'a member edits their own name and radio');
select throws_ok($$update public.club_members set role = 'admin' where display_name = 'Maxine'$$,
  '42501', null, 'a member cannot promote themselves');
select is(tests.affected_rows($$update public.club_members set display_name = 'Hacked'
                                where display_name = 'ada'$$), 0::bigint,
  'a member cannot edit someone else');
select is(tests.affected_rows($$delete from public.club_members where display_name = 'gus'$$),
  0::bigint, 'a member cannot remove someone else');

select tests.authenticate_as('gus');
select is((select count(*) from public.club_members), 4::bigint,
  'a guest with a valid pass reads the roster');

select tests.authenticate_as('eve');
select is_empty($$select 1 from public.club_members$$, 'an expired guest reads nothing');

select tests.authenticate_as('pat');
select is_empty($$select 1 from public.club_members where club_id = tests.club_id('Oak Ridge')$$,
  'another club''s admin cannot read this roster');
select throws_ok(
  $$insert into public.club_members (club_id, user_id, display_name, initials)
    values (tests.club_id('Oak Ridge'), tests.user_id('newbie'), 'Newbie', 'NB')$$,
  '42501', null, 'another club''s admin cannot add members here'
);

select tests.authenticate_as('ada');
select lives_ok(
  $$insert into public.club_members (club_id, user_id, display_name, initials)
    values (tests.club_id('Oak Ridge'), tests.user_id('newbie'), 'Newbie', 'NB')$$,
  'an admin adds a member'
);
select is(tests.affected_rows($$update public.club_members set role = 'admin'
                                where display_name = 'Newbie'$$), 1::bigint,
  'an admin promotes a member');
select is(tests.affected_rows($$update public.club_members set role = 'member'
                                where display_name = 'ada'$$), 1::bigint,
  'an admin can step down while another admin remains');

select tests.authenticate_as('newbie');
select throws_ok($$update public.club_members set role = 'member' where display_name = 'Newbie'$$,
  '23514', null, 'the last admin cannot step down');
select throws_ok($$delete from public.club_members where display_name = 'Newbie'$$,
  '23514', null, 'the last admin cannot leave');

select tests.authenticate_as('max');
select is(tests.affected_rows($$delete from public.club_members where display_name = 'Maxine'$$),
  1::bigint, 'a member can leave the club');

select tests.authenticate_as_anon();
select throws_ok($$select 1 from public.club_members$$, '42501', null,
  'anonymous users cannot read rosters');

select * from finish();
rollback;
