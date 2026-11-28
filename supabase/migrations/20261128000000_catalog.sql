-- The achievements and easter eggs that exist (docs/plans/LOOP_BACKLOG.md, Platform step 2).
-- The game's code is the master list (`ACHIEVEMENTS` and `EGGS` in web/src/48-gallery.js, `SHIPPED_IDS` in the
-- tests). Its rows are added only by the migrations scripts/accounts/build_catalog.py writes, and never removed:
-- saved progress refers to them. A test fails if the code and these rows ever differ.
create table public.catalog (
  kind      text not null check (kind in ('ach', 'egg')),
  item_id   text not null check (item_id ~ '^[\w-]{1,40}$'),
  added_on  date not null,
  primary key (kind, item_id)
);

-- Nothing on a web page needs it: no grants, no policies, so only the owner's tools and the functions see it.
alter table public.catalog enable row level security;
revoke all on public.catalog from anon, authenticated;
