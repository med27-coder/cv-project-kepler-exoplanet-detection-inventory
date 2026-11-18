-- The owner's admin account, and three fixes from the security review of 20261117000000_accounts.sql.

-- ---------------------------------------------------------------- 1. an admin role (the owner only)
-- An admin signs in on the page like any pilot and gets the personal view (the tester panel, sync details, the
-- admin badge). Granting the role is possible only for the database owner: admin_set_role is callable by the
-- service role (the admin script), never by a page.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('player', 'tester', 'admin'));
alter table public.limits add column max_admins integer not null default 1 check (max_admins >= 0);

create or replace function public.check_testers() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'tester' and old.role is distinct from 'tester'
     and (select count(*) from public.profiles where role = 'tester') >= (select max_testers from public.limits) then
    raise exception 'Tester limit reached.' using errcode = 'P0001';
  end if;
  if new.role = 'admin' and old.role is distinct from 'admin'
     and (select count(*) from public.profiles where role = 'admin') >= (select max_admins from public.limits) then
    raise exception 'Admin limit reached.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create function public.admin_set_role(pilot text, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = new_role where pilot_name = upper(pilot);
  if not found then raise exception 'No pilot named %.', upper(pilot) using errcode = 'P0001'; end if;
  insert into public.admin_audit (action, target, result) values ('role ' || new_role, upper(pilot), 'ok');
end $$;
revoke execute on function public.admin_set_role(text, text) from public, anon, authenticated;
grant execute on function public.admin_set_role(text, text) to service_role;

-- ---------------------------------------------------------------- 2. sign-in names can't become real emails
-- A player could otherwise change its email (or add a phone) through the auth service and store a real identity.
create function public.keep_pilot_identity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pilot text := (select pilot_name from public.profiles where user_id = new.id);
begin
  if pilot is null then return new; end if;   -- the account is being created or deleted
  if lower(new.email) is distinct from lower(pilot) || '@pilots.invalid'
     or coalesce(new.email_change, '') not in ('', lower(pilot) || '@pilots.invalid')
     or new.phone is distinct from old.phone or coalesce(new.phone_change, '') <> coalesce(old.phone_change, '') then
    raise exception 'Pilot accounts have no email or phone.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.keep_pilot_identity() from public, anon, authenticated;

create trigger keep_pilot_identity before update of email, email_change, phone, phone_change on auth.users
  for each row execute function public.keep_pilot_identity();

-- ---------------------------------------------------------------- 3a. the finds cap counts the account's total
create function public.cap_finds() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.finds where user_id = new.user_id and kind = new.kind) > 300 then
    raise exception 'Too many finds.' using errcode = '22023';
  end if;
  return null;
end $$;
revoke execute on function public.cap_finds() from public, anon, authenticated;

create constraint trigger cap_finds after insert on public.finds
  for each row execute function public.cap_finds();

-- ---------------------------------------------------------------- 3b. reset counts as a save
create or replace function public.reset_progress() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select updated_at from public.progress where user_id = auth.uid())
     > now() - (select save_gap from public.limits) then
    raise exception 'Saving too often.' using errcode = 'P0002';
  end if;
  delete from public.finds where user_id = auth.uid();
  update public.progress set data = '{}', updated_at = now() where user_id = auth.uid();
end $$;
