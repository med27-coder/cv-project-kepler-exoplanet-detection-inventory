-- Player accounts for the Kepler Star Map (docs/plans/ACCOUNTS_AND_ACCESS.md, section 9).
--
-- Sign-in is Supabase Auth with a pilot name and password, no email: the page signs up "<pilot>@pilots.invalid"
-- (.invalid is reserved and never delivers mail) and passes the pilot name in the user metadata.
-- Players read their own rows; they never write a table directly. Every write goes through one of the functions
-- at the end (security definer), which check the data and the limits.

-- ---------------------------------------------------------------- limits (one row, admin only)
create table public.limits (
  id            boolean primary key default true check (id),   -- a single row
  max_accounts  integer not null default 200 check (max_accounts > 0),
  max_testers   integer not null default 5 check (max_testers >= 0),
  save_gap      interval not null default interval '5 seconds'
);
insert into public.limits default values;

-- ---------------------------------------------------------------- identity: one profile per account
create table public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  pilot_name  text not null unique check (pilot_name ~ '^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$'),
  emblem      text check (emblem ~ '^[a-z0-9-]{1,40}$'),   -- one of the game's emblems, as the picture
  role        text not null default 'player' check (role in ('player', 'tester')),   -- the admin sets it
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- settings: the newest change wins
create table public.preferences (
  user_id       uuid primary key references public.profiles (user_id) on delete cascade,
  toasts        boolean not null default true,
  sound         boolean not null default true,
  sound_choice  boolean not null default false,   -- true once the player set the sound themselves
  backdrop      text not null default 'animated' check (backdrop in ('animated', 'still', 'plain')),
  model         text not null default 'stargazer' check (model in ('stargazer', 'colossus')),
  outfit        text not null default '' check (outfit ~ '^[\w-]{0,40}$'),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- finds: one row per achievement or easter egg
create table public.finds (
  user_id   uuid not null references public.profiles (user_id) on delete cascade,
  kind      text not null check (kind in ('ach', 'egg')),
  item_id   text not null check (item_id ~ '^[\w-]{1,40}$'),
  found_on  date not null check (found_on between date '2026-01-01' and current_date + 1),
  primary key (user_id, kind, item_id)
);

-- ---------------------------------------------------------------- everything else earned (merged by the page)
create table public.progress (
  user_id     uuid primary key references public.profiles (user_id) on delete cascade,
  data        jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 200000),
  schema      smallint not null default 1,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- the admin log (no web page can read it)
create table public.admin_audit (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  action  text not null,
  target  text,
  result  text not null,
  detail  jsonb
);

-- ---------------------------------------------------------------- who may touch what
alter table public.limits      enable row level security;
alter table public.profiles    enable row level security;
alter table public.preferences enable row level security;
alter table public.finds       enable row level security;
alter table public.progress    enable row level security;
alter table public.admin_audit enable row level security;

revoke all on public.limits, public.profiles, public.preferences, public.finds, public.progress, public.admin_audit
  from anon, authenticated;
grant select on public.profiles, public.preferences, public.finds, public.progress to authenticated;

create policy "own profile"     on public.profiles    for select to authenticated using (user_id = (select auth.uid()));
create policy "own preferences" on public.preferences for select to authenticated using (user_id = (select auth.uid()));
create policy "own finds"       on public.finds       for select to authenticated using (user_id = (select auth.uid()));
create policy "own progress"    on public.progress    for select to authenticated using (user_id = (select auth.uid()));
-- limits and admin_audit: no policies, so only the service role (the admin script) sees them.

-- ---------------------------------------------------------------- sign-up: name rules, the account cap, a profile
create function public.on_new_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pilot text := upper(coalesce(new.raw_user_meta_data ->> 'pilot_name', ''));
begin
  perform pg_advisory_xact_lock(hashtext('kepler.sign-up'));   -- one sign-up at a time, so the cap holds
  if (select count(*) from public.profiles) >= (select max_accounts from public.limits) then
    raise exception 'The star map is full for now: no new accounts.' using errcode = 'P0001';
  end if;
  if pilot !~ '^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$' then
    raise exception 'Pilot names are 3 to 20 letters, digits or dashes.' using errcode = 'P0001';
  end if;
  if lower(new.email) is distinct from lower(pilot) || '@pilots.invalid' then
    raise exception 'Sign up with a pilot name only.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where pilot_name = pilot) then
    raise exception 'That pilot name is taken.' using errcode = 'P0001';
  end if;
  insert into public.profiles (user_id, pilot_name) values (new.id, pilot);
  insert into public.preferences (user_id) values (new.id);
  insert into public.progress (user_id, updated_at) values (new.id, now() - interval '1 hour');   -- first save at once
  return new;
end $$;

create trigger on_new_account after insert on auth.users
  for each row execute function public.on_new_account();

-- ---------------------------------------------------------------- testers: at most max_testers
create function public.check_testers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'tester' and old.role is distinct from 'tester'
     and (select count(*) from public.profiles where role = 'tester') >= (select max_testers from public.limits) then
    raise exception 'Tester limit reached.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger check_testers before update of role on public.profiles
  for each row execute function public.check_testers();

-- ---------------------------------------------------------------- the page's calls
-- Only these keys of the page's saved progress go into progress.data (the rest are finds or preferences).
create function public.progress_keys() returns text[]
language sql immutable set search_path = '' as $$
  select array['systems', 'seen', 'viewed', 'finalEmblem', 'whiteHole', 'calls', 'notified', 'showcase', 'levels',
               'toured', 'daily', 'lastExport', 'lastStars', 'outfits', 'astroVisits', 'astroLastRoll', 'astroDry',
               'astroDays', 'comets', 'asteroids', 'ufos', 'meteors']
$$;

-- The whole saved progress, in the page's own shape (what mergeProgress reads).
create function public.load_progress() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(p.data, '{}') || jsonb_build_object(
      'pilot', pr.pilot_name, 'role', pr.role, 'emblem', pr.emblem, 'updatedAt', p.updated_at,
      'eggs', coalesce((select jsonb_object_agg(item_id, found_on) from public.finds f
                        where f.user_id = pr.user_id and kind = 'egg'), '{}'),
      'ach',  coalesce((select jsonb_object_agg(item_id, found_on) from public.finds f
                        where f.user_id = pr.user_id and kind = 'ach'), '{}'),
      'toasts', pf.toasts, 'sound', pf.sound, 'soundChoice', pf.sound_choice, 'backdrop', pf.backdrop,
      'model', pf.model, 'outfit', pf.outfit)
  from public.profiles pr
  join public.preferences pf using (user_id)
  join public.progress p using (user_id)
  where pr.user_id = auth.uid()
$$;

-- Save the page's progress (already merged by the page). Finds keep the earliest date on the server too, so an
-- older browser can never erase a newer find. Refuses saves closer together than limits.save_gap.
create function public.save_progress(payload jsonb) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me     uuid := auth.uid();
  gap    interval := (select save_gap from public.limits);
  extra  jsonb;
  k      text;
  saved  timestamptz;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or pg_column_size(payload) > 250000 then
    raise exception 'That does not look like saved progress.' using errcode = '22023';
  end if;
  if (select updated_at from public.progress where user_id = me) > now() - gap then
    raise exception 'Saving too often.' using errcode = 'P0002';
  end if;

  -- finds: at most 300 of each kind, valid ids and dates; the earliest date wins
  foreach k in array array['ach', 'egg'] loop
    if jsonb_typeof(payload -> (case k when 'egg' then 'eggs' else 'ach' end)) = 'object' then
      if (select count(*) from jsonb_object_keys(payload -> (case k when 'egg' then 'eggs' else 'ach' end))) > 300 then
        raise exception 'Too many finds.' using errcode = '22023';
      end if;
      insert into public.finds (user_id, kind, item_id, found_on)
        select me, k, e.key, (e.value #>> '{}')::date
        from jsonb_each(payload -> (case k when 'egg' then 'eggs' else 'ach' end)) e
        where e.key ~ '^[\w-]{1,40}$' and (e.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
      on conflict (user_id, kind, item_id) do update set found_on = least(public.finds.found_on, excluded.found_on);
    end if;
  end loop;

  -- preferences: only valid values change anything
  update public.preferences set
    toasts       = case when jsonb_typeof(payload -> 'toasts') = 'boolean' then (payload ->> 'toasts')::boolean else toasts end,
    sound        = case when jsonb_typeof(payload -> 'sound') = 'boolean' then (payload ->> 'sound')::boolean else sound end,
    sound_choice = case when jsonb_typeof(payload -> 'soundChoice') = 'boolean' then (payload ->> 'soundChoice')::boolean else sound_choice end,
    backdrop     = case when payload ->> 'backdrop' in ('animated', 'still', 'plain') then payload ->> 'backdrop' else backdrop end,
    model        = case when payload ->> 'model' in ('stargazer', 'colossus') then payload ->> 'model' else model end,
    outfit       = case when coalesce(payload ->> 'outfit', '') ~ '^[\w-]{0,40}$' and payload ? 'outfit' then payload ->> 'outfit' else outfit end,
    updated_at   = now()
  where user_id = me;

  -- the rest: only known keys, each of the right type and size
  select coalesce(jsonb_object_agg(key, value), '{}') into extra
  from jsonb_each(payload) where key = any (public.progress_keys());
  if (extra ? 'seen' and (jsonb_typeof(extra -> 'seen') <> 'string' or length(extra ->> 'seen') > 80000
                           or (extra ->> 'seen') !~ '^[0-9a-z,]*$'))
     or (extra ? 'systems'   and (jsonb_typeof(extra -> 'systems')   <> 'array' or jsonb_array_length(extra -> 'systems') > 200))
     or (extra ? 'viewed'    and (jsonb_typeof(extra -> 'viewed')    <> 'array' or jsonb_array_length(extra -> 'viewed') > 300))
     or (extra ? 'outfits'   and (jsonb_typeof(extra -> 'outfits')   <> 'array' or jsonb_array_length(extra -> 'outfits') > 40))
     or (extra ? 'showcase'  and (jsonb_typeof(extra -> 'showcase')  <> 'array' or jsonb_array_length(extra -> 'showcase') > 3))
     or (extra ? 'astroDays' and (jsonb_typeof(extra -> 'astroDays') <> 'array' or jsonb_array_length(extra -> 'astroDays') > 30))
     or (extra ? 'notified'  and (jsonb_typeof(extra -> 'notified')  <> 'array' or jsonb_array_length(extra -> 'notified') > 3000))
     or (extra ? 'calls'     and (jsonb_typeof(extra -> 'calls')     <> 'object'
                                  or (select count(*) from jsonb_object_keys(extra -> 'calls')) > 2000))
  then
    raise exception 'That does not look like saved progress.' using errcode = '22023';
  end if;

  -- keys the save leaves out keep their stored value, so a partial save can't erase anything
  update public.progress set data = public.progress.data || extra, updated_at = now()
    where user_id = me returning updated_at into saved;
  return saved;
end $$;

-- Change the emblem shown as the picture (null clears it).
create function public.set_emblem(emblem text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if emblem is not null and emblem !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Unknown emblem.' using errcode = '22023';
  end if;
  update public.profiles set emblem = set_emblem.emblem where user_id = auth.uid();
end $$;

-- Reset: forget everything earned, keep the account and its settings.
create function public.reset_progress() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.finds where user_id = auth.uid();
  update public.progress set data = '{}', updated_at = now() - interval '1 hour' where user_id = auth.uid();
end $$;

-- DELETE MY ACCOUNT: the account and every row that belongs to it (cascades).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.on_new_account(), public.check_testers() from public, anon, authenticated;
revoke execute on function public.load_progress(), public.save_progress(jsonb), public.set_emblem(text),
  public.reset_progress(), public.delete_my_account() from public, anon;
grant execute on function public.load_progress(), public.save_progress(jsonb), public.set_emblem(text),
  public.reset_progress(), public.delete_my_account() to authenticated;
