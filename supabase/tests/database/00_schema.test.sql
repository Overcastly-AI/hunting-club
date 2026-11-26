-- Structure, constraints and triggers that every other test relies on.
begin;
\ir ../../scripts/test-helpers.sql
select plan(22);

-- Every table in public has RLS enabled.
select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  null,
  'every public table has row-level security enabled'
);

select tables_are('public', array[
  'plans', 'clubs', 'club_secrets', 'club_members', 'subscriptions', 'invites',
  'areas', 'stands', 'harvests', 'map_packs', 'stripe_events'
], 'public has exactly the spec''s cloud tables plus plans');

select enum_has_labels('public', 'stand_type', array['tree_stand', 'ladder', 'ground_blind'],
  'stand types match the spec');
select enum_has_labels('public', 'member_role', array['admin', 'member', 'guest'],
  'member roles match the spec');

-- Helpers are not exposed through the API schema.
select hasnt_function('public', 'is_club_member', 'membership helper is not in public');
select has_function('private', 'is_club_member', array['uuid'], 'private.is_club_member exists');
select has_function('private', 'is_club_admin', array['uuid'], 'private.is_club_admin exists');

-- Indexes on club_id for RLS-filtered tables.
select has_index('public', 'stands', 'stands_club_id_idx', 'stands indexed by club_id');
select has_index('public', 'harvests', 'harvests_club_id_idx', 'harvests indexed by club_id');
select has_index('public', 'club_members', 'club_members_club_id_idx', 'members indexed by club_id');

-- Constraints.
select tests.seed_two_clubs();

select throws_ok(
  $$insert into public.club_secrets (club_id, channel_key)
    values (tests.create_club('Short Key', 'sam'), '\x0102')$$,
  '23514', null, 'channel key must be exactly 32 bytes'
);

select throws_ok(
  $$insert into public.stands (club_id, name, type, lat, lon)
    values (tests.club_id('Oak Ridge'), 'Nowhere', 'ladder', 91, 0)$$,
  '23514', null, 'stand latitude must be valid'
);

select throws_ok(
  $$insert into public.stands (club_id, name, type, lat, lon)
    values (tests.club_id('Oak Ridge'), 'Bad Type', 'hammock', 40, -90)$$,
  '22P02', null, 'stand type must be a known type'
);

select throws_ok(
  $$insert into public.areas (club_id, name, boundary)
    values (tests.club_id('Oak Ridge'), 'Pointy', '{"type":"Point","coordinates":[0,0]}')$$,
  '23514', null, 'area boundary must be a GeoJSON polygon'
);

select throws_ok(
  $$insert into public.stands (club_id, area_id, name, type, lat, lon)
    values (tests.club_id('Pine Hollow'),
            (select id from public.areas where name = 'North 40'), 'Stolen', 'ladder', 40, -90)$$,
  '23503', null, 'a stand cannot sit in another club''s area'
);

select throws_ok(
  $$insert into public.harvests (club_id, member_id, species, harvested_at)
    values (tests.club_id('Pine Hollow'), tests.member_id(tests.club_id('Oak Ridge'), 'max'),
            'turkey', now())$$,
  '23503', null, 'a harvest''s member must belong to the same club'
);

select throws_ok(
  $$insert into public.club_members (club_id, user_id, display_name, initials, role, expires_at)
    values (tests.club_id('Oak Ridge'), tests.create_user('temp'), 'Temp', 'TA', 'admin', now())$$,
  '23514', null, 'admins cannot have an expiry'
);

select throws_ok(
  $$insert into public.invites (club_id, role, expires_at)
    values (tests.club_id('Oak Ridge'), 'admin', now() + interval '1 day')$$,
  '23514', null, 'invites cannot grant admin'
);

select throws_ok(
  $$insert into public.club_members (club_id, user_id, display_name, initials)
    values (tests.club_id('Oak Ridge'), tests.user_id('max'), 'Max again', 'MX')$$,
  '23505', null, 'a user joins a club at most once'
);

-- Tokens are long and random.
select cmp_ok(length(tests.create_invite(tests.club_id('Oak Ridge'))), '>=', 64,
  'invite tokens are at least 256 bits of hex');

-- updated_at is maintained by trigger.
update public.stands set updated_at = '2000-01-01' where name = 'Creek Stand';
update public.stands set notes = 'Climber on the oak' where name = 'Creek Stand';
select cmp_ok((select updated_at from public.stands where name = 'Creek Stand'), '>',
  '2000-01-02'::timestamptz, 'updated_at is set on update');

-- Deleting a club cascades even though it removes the last admin.
delete from public.clubs where name = 'Pine Hollow';
select is((select count(*) from public.club_members m where m.club_id is null), 0::bigint,
  'deleting a club cascades to its members');

select * from finish();
rollback;
