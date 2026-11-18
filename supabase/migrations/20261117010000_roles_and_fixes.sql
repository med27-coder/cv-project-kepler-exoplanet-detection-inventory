-- Setting roles (the owner only), and three fixes from the security review of 20261117000000_accounts.sql.

-- ---------------------------------------------------------------- 1. roles are set by the owner
-- set_role (player or tester, at most limits.max_testers testers) is callable only by the service role, that is the
-- owner's script (scripts/accounts/manage.py), never by a page. Every change is logged.
create function public.set_role(pilot text, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set role = new_role where pilot_name = upper(pilot);
  if not found then raise exception 'No pilot named %.', upper(pilot) using errcode = 'P0001'; end if;
  insert into public.audit_log (action, target, result) values ('role ' || new_role, upper(pilot), 'ok');
end $$;
revoke execute on function public.set_role(text, text) from public, anon, authenticated;
grant execute on function public.set_role(text, text) to service_role;

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
