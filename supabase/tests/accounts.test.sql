-- The account rules (docs/plans/ACCOUNTS_AND_ACCESS.md): run with `npx supabase@2.122.1 test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- helpers: sign up as the auth service would, and act as a signed-in player
create function pg_temp.sign_up(explorer text, email text default null) returns uuid language plpgsql as $$
declare id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values (id, coalesce(email, lower(explorer) || '@explorers.invalid'), jsonb_build_object('explorer_name', explorer),
            'authenticated', 'authenticated');
  return id;
end $$;
create function pg_temp.act_as(id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- ---------------------------------------------------------------- sign-up
select lives_ok($$ select pg_temp.sign_up('NOVA-0001') $$, 'an explorer name signs up');
select is((select count(*)::int from public.profiles p join public.preferences using (user_id)
           join public.progress using (user_id) where explorer_name = 'NOVA-0001'), 1,
          'sign-up makes the profile, preferences and progress rows');
select is((select role from public.profiles where explorer_name = 'NOVA-0001'), 'player', 'new accounts are players');
select throws_ok($$ select pg_temp.sign_up('X') $$, 'P0001', 'Explorer names are 3 to 20 letters, digits or dashes.',
                 'too short a name is refused');
select throws_ok($$ select pg_temp.sign_up('-BAD-') $$, 'P0001', 'Explorer names are 3 to 20 letters, digits or dashes.',
                 'a name starting with a dash is refused');
select throws_ok($$ select pg_temp.sign_up('NOVA-0002', 'someone@example.com') $$, 'P0001',
                 'Sign up with an explorer name only.', 'a real email is refused');
select throws_ok($$ select pg_temp.sign_up('NOVA-0003', 'nova-0003@pilots.invalid') $$, 'P0001',
                 'Sign up with an explorer name only.', 'the old pilot address is refused');
select throws_ok($$ select pg_temp.sign_up('nova-0001', 'nova-0001@explorers.invalid') $$, '23505', null,
                 'a taken name is refused, whatever its case');

create temp table ids as select pg_temp.sign_up('ORBITER-7') as orbiter,
                                (select user_id from public.profiles where explorer_name = 'NOVA-0001') as explorer;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- the account cap
update public.limits set max_accounts = (select count(*) from public.profiles);
select throws_ok($$ select pg_temp.sign_up('LATECOMER') $$, 'P0001', 'The star map is full for now: no new accounts.',
                 'sign-ups past the cap are refused');
update public.limits set max_accounts = 200;

-- ---------------------------------------------------------------- testers (only the owner, at most max_testers)
update public.limits set max_testers = (select count(*) from public.profiles where role = 'tester') + 1;   -- room for one more
select lives_ok($$ update public.profiles set role = 'tester' where explorer_name = 'ORBITER-7' $$, 'the owner makes a tester directly');
select throws_ok($$ update public.profiles set role = 'tester' where explorer_name = 'NOVA-0001' $$, 'P0001',
                 'Tester limit reached.', 'testers past the limit are refused');
update public.limits set max_testers = 5;

-- ---------------------------------------------------------------- saving and loading (as NOVA-0001)
select pg_temp.act_as((select explorer from ids));
select lives_ok($$ select public.save_progress('{"eggs": {"pluto": "2026-11-10"}, "ach": {"first-light": "2026-11-12"},
  "sound": false, "backdrop": "still", "systems": ["Kepler-16"], "seen": "abc,1z", "comets": 3, "junk": "x"}') $$,
  'a save is accepted');
select throws_ok($$ select public.save_progress('{}') $$, 'P0002', 'Saving too often.', 'a second save at once is refused');
reset role;
update public.limits set save_gap = interval '0';   -- the rest of the tests save freely
select pg_temp.act_as((select explorer from ids));

select lives_ok($$ select public.save_progress('{"eggs": {"pluto": "2026-11-15"}, "ach": {"first-light": "2026-11-11"}}') $$,
                'a partial save from an older browser is accepted');
select is(public.load_progress() -> 'eggs' ->> 'pluto', '2026-11-10', 'a find keeps its earliest date (later date ignored)');
select is(public.load_progress() -> 'ach' ->> 'first-light', '2026-11-11', 'a find keeps its earliest date (earlier date taken)');
select is(public.load_progress() -> 'systems', '["Kepler-16"]'::jsonb, 'a partial save keeps what it left out');
select is((public.load_progress() -> 'comets')::int, 3, 'counters are kept');
select ok(not public.load_progress() ? 'junk', 'unknown keys are dropped');
select is(public.load_progress() ->> 'backdrop', 'still', 'preferences are saved');
select is(public.load_progress() ->> 'explorer', 'NOVA-0001', 'the load names the explorer');

select throws_ok($$ select public.save_progress(jsonb_build_object('seen', repeat('a,', 45000))) $$, '22023',
                 'That does not look like saved progress.', 'an oversized stars-seen list is refused');
select throws_ok($$ select public.save_progress('{"systems": "not a list"}') $$, '22023',
                 'That does not look like saved progress.', 'a wrong type is refused');
select lives_ok($$ select public.save_progress('{"backdrop": "neon"}') $$, 'a save with an invalid setting is accepted');
select is(public.load_progress() ->> 'backdrop', 'still', 'an invalid setting value is ignored');

-- ---------------------------------------------------------------- the catalog: only real ids are kept
select lives_ok($$ select public.save_progress('{"eggs": {"no-such-egg": "2026-11-20", "sun": "2026-11-20"}}') $$,
                'a save naming an unknown id is still accepted');
select ok(not (public.load_progress() -> 'eggs' ? 'no-such-egg'), 'the unknown id is skipped');
select is(public.load_progress() -> 'eggs' ->> 'sun', '2026-11-20', 'the rest of that save is kept');

-- ---------------------------------------------------------------- privacy
select throws_ok($$ insert into public.finds values ((select orbiter from ids), 'egg', 'x', current_date) $$, '42501',
                 null, 'a player cannot write a table directly');
select throws_ok($$ update public.profiles set role = 'tester' $$, '42501', null, 'a player cannot make itself a tester');
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'a player cannot read the audit log');
select throws_ok($$ select * from public.catalog $$, '42501', null, 'a player cannot read the catalog');
reset role;
select pg_temp.act_as((select orbiter from ids));
select is((select count(*)::int from public.finds), 0, 'another player sees none of these finds');
select is((select count(*)::int from public.profiles), 1, 'another player sees only its own profile');

-- ---------------------------------------------------------------- the security review's fixes
reset role;
select ok((select count(*) from public.catalog where kind = 'ach') >= 81, 'the catalog holds the achievements');
select ok((select count(*) from public.catalog where kind = 'egg') >= 38, 'the catalog holds the easter eggs');
select fk_ok('public', 'finds', array['kind', 'item_id'], 'public', 'catalog', array['kind', 'item_id'],
             'a find must name a catalog id');
select throws_ok($$ update auth.users set email = 'real.person@example.com' where id = (select orbiter from ids) $$,
                 'P0001', 'Explorer accounts have no email or phone.', 'an explorer cannot change to a real email');
select throws_ok($$ update auth.users set email_change = 'real.person@example.com' where id = (select orbiter from ids) $$,
                 'P0001', 'Explorer accounts have no email or phone.', 'an explorer cannot start an email change');
select throws_ok($$ update auth.users set phone = '15550100' where id = (select orbiter from ids) $$,
                 'P0001', 'Explorer accounts have no email or phone.', 'an explorer cannot add a phone');
select lives_ok($$ update auth.users set last_sign_in_at = now() where id = (select orbiter from ids) $$,
                'normal sign-ins still update the account');
insert into public.catalog (kind, item_id, added_on)   -- 301 test ids, so the cap can be reached
  select 'egg', 'egg-' || n, current_date from generate_series(1, 300) n union all select 'egg', 'one-more', current_date;
select pg_temp.act_as((select orbiter from ids));
select lives_ok($$ select public.save_progress(jsonb_build_object('eggs',
                     (select jsonb_object_agg('egg-' || n, '2026-11-01') from generate_series(1, 300) n))) $$,
                '300 eggs fit');
select throws_ok($$ select public.save_progress('{"eggs": {"one-more": "2026-11-02"}}') $$, '22023', 'Too many finds.',
                 'the cap counts the account total, not one save');
reset role;
update public.limits set save_gap = interval '1 hour';
select pg_temp.act_as((select orbiter from ids));
select throws_ok($$ select public.reset_progress() $$, 'P0002', 'Saving too often.', 'reset obeys the save gap');
select throws_ok($$ select public.set_role('ORBITER-7', 'tester') $$, '42501', null,
                 'a player cannot set roles');
reset role;
update public.limits set save_gap = interval '0';

-- ---------------------------------------------------------------- set_role (the owner's script only)
select lives_ok($$ select public.set_role('nova-0001', 'tester') $$, 'the owner makes a tester');
select throws_ok($$ select public.set_role('ORBITER-7', 'owner') $$, '23514', null, 'only player and tester exist');
select is((select count(*)::int from public.audit_log where action = 'role tester' and target = 'NOVA-0001'), 1, 'role changes are logged');
select throws_ok($$ select public.set_role('NOBODY', 'tester') $$, 'P0001', 'No explorer named NOBODY.',
                 'an unknown explorer is reported');
select pg_temp.act_as((select explorer from ids));
select is(public.load_progress() ->> 'role', 'tester', 'a tester sees its role on load');

-- ---------------------------------------------------------------- reset and delete
reset role;
select pg_temp.act_as((select explorer from ids));
select public.reset_progress();
select is(public.load_progress() -> 'eggs', '{}'::jsonb, 'reset forgets every find');
select public.delete_my_account();
reset role;
select is((select count(*)::int from public.profiles where explorer_name = 'NOVA-0001'), 0,
          'DELETE MY ACCOUNT removes the account and its rows');

select * from finish();
rollback;
