-- A find must name an achievement or easter egg the catalog knows (20261128000000_catalog.sql).
--
-- A save from a newer page may name an id this database has not been given yet (the site and the database are
-- updated separately). That one find is skipped, not the whole save: the browser keeps it and saves it again
-- with everything else next time, after the catalog has caught up.

-- Finds with ids that never existed (only possible before this rule) go.
delete from public.finds f
  where not exists (select 1 from public.catalog c where c.kind = f.kind and c.item_id = f.item_id);

create function public.skip_unknown_finds() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.catalog where kind = new.kind and item_id = new.item_id) then
    return null;   -- skip this row only
  end if;
  return new;
end $$;

revoke execute on function public.skip_unknown_finds() from public, anon, authenticated;

create trigger skip_unknown_finds before insert on public.finds
  for each row execute function public.skip_unknown_finds();

-- And the database itself holds the rule, whatever writes the row.
alter table public.finds
  add constraint finds_in_catalog foreign key (kind, item_id) references public.catalog (kind, item_id);
