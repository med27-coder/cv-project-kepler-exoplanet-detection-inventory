-- "Pilot" becomes "explorer" (docs/plans/LOOP_BACKLOG.md, Platform step 9; docs/plans/EXPLORER_JOURNEY.md E).
-- The column, the sign-in address (<name>@explorers.invalid; .invalid is reserved and never delivers mail), the
-- sign-up metadata key (explorer_name), the messages, the load's key and the owner's set_role. Accounts made
-- before keep their names; their sign-in addresses move to the new domain here, so they sign in as before.

-- ---------------------------------------------------------------- the column
alter table public.profiles rename column pilot_name to explorer_name;
alter table public.profiles rename constraint profiles_pilot_name_key to profiles_explorer_name_key;
alter table public.profiles rename constraint profiles_pilot_name_check to profiles_explorer_name_check;

-- ---------------------------------------------------------------- existing accounts move to the new address
drop trigger keep_pilot_identity on auth.users;   -- it would refuse the move; replaced below
drop function public.keep_pilot_identity();

update auth.users u
  set email = lower(p.explorer_name) || '@explorers.invalid',
      raw_user_meta_data = (coalesce(u.raw_user_meta_data, '{}') - 'pilot_name')
                           || jsonb_build_object('explorer_name', p.explorer_name)
  from public.profiles p where p.user_id = u.id;
update auth.identities i
  set identity_data = i.identity_data || jsonb_build_object('email', lower(p.explorer_name) || '@explorers.invalid')
  from public.profiles p where p.user_id = i.user_id and i.provider = 'email';

-- ---------------------------------------------------------------- sign-up
create or replace function public.on_new_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  explorer text := upper(coalesce(new.raw_user_meta_data ->> 'explorer_name', ''));
begin
  perform pg_advisory_xact_lock(hashtext('kepler.sign-up'));   -- one sign-up at a time, so the cap holds
  if (select count(*) from public.profiles) >= (select max_accounts from public.limits) then
    raise exception 'The star map is full for now: no new accounts.' using errcode = 'P0001';
  end if;
  if explorer !~ '^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$' then
    raise exception 'Explorer names are 3 to 20 letters, digits or dashes.' using errcode = 'P0001';
  end if;
  if lower(new.email) is distinct from lower(explorer) || '@explorers.invalid' then
    raise exception 'Sign up with an explorer name only.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where explorer_name = explorer) then
    raise exception 'That explorer name is taken.' using errcode = 'P0001';
  end if;
  insert into public.profiles (user_id, explorer_name) values (new.id, explorer);
  insert into public.preferences (user_id) values (new.id);
  insert into public.progress (user_id, updated_at) values (new.id, now() - interval '1 hour');   -- first save at once
  return new;
end $$;

-- ---------------------------------------------------------------- sign-in names can't become real emails
create function public.keep_explorer_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  explorer text := (select explorer_name from public.profiles where user_id = new.id);
begin
  if explorer is null then return new; end if;   -- the account is being created or deleted
  if lower(new.email) is distinct from lower(explorer) || '@explorers.invalid'
     or coalesce(new.email_change, '') not in ('', lower(explorer) || '@explorers.invalid')
     or new.phone is distinct from old.phone or coalesce(new.phone_change, '') <> coalesce(old.phone_change, '') then
    raise exception 'Explorer accounts have no email or phone.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.keep_explorer_identity() from public, anon, authenticated;

create trigger keep_explorer_identity before update of email, email_change, phone, phone_change on auth.users
  for each row execute function public.keep_explorer_identity();

-- ---------------------------------------------------------------- the owner's set_role
drop function public.set_role(text, text);
create function public.set_role(explorer text, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = new_role where explorer_name = upper(explorer);
  if not found then raise exception 'No explorer named %.', upper(explorer) using errcode = 'P0001'; end if;
  insert into public.audit_log (action, target, result) values ('role ' || new_role, upper(explorer), 'ok');
end $$;
revoke execute on function public.set_role(text, text) from public, anon, authenticated;
grant execute on function public.set_role(text, text) to service_role;

-- ---------------------------------------------------------------- the load names the explorer
create or replace function public.load_progress() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(p.data, '{}') || jsonb_build_object(
      'explorer', pr.explorer_name, 'role', pr.role, 'emblem', pr.emblem, 'updatedAt', p.updated_at,
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
