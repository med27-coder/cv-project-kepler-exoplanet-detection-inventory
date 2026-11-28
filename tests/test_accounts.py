"""The player-account database's files (the database itself is tested by `supabase test db`, supabase/tests/)."""

import importlib
from datetime import date
from pathlib import Path

import pytest
from test_web_data import SHIPPED_IDS

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def catalog(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / 'scripts' / 'accounts'))
    return importlib.import_module('build_catalog')


def test_the_database_catalog_matches_the_code(catalog):
    """Every achievement and easter egg in the game is in the database's catalog, and nothing else is."""
    assert catalog.catalog_ids() == catalog.code_ids(), 'run scripts/accounts/build_catalog.py'
    shipped = {('egg', i) for i in SHIPPED_IDS['eggs']} | {('ach', i) for i in SHIPPED_IDS['ach']}
    assert shipped <= catalog.catalog_ids()


def test_new_ids_get_their_own_migration(catalog, tmp_path, monkeypatch):
    """A new achievement adds a migration with just that id; a removed one is refused."""
    js = catalog.GALLERY.read_text(encoding='utf-8')
    gallery = tmp_path / '48-gallery.js'
    migrations = tmp_path / 'migrations'
    migrations.mkdir()
    for f in catalog.MIGRATIONS.glob('*.sql'):
        (migrations / f.name).write_text(f.read_text(encoding='utf-8'), encoding='utf-8')
    monkeypatch.setattr(catalog, 'GALLERY', gallery)
    monkeypatch.setattr(catalog, 'MIGRATIONS', migrations)
    monkeypatch.setattr(catalog, 'ROOT', tmp_path)

    gallery.write_text(js.replace("const ACHIEVEMENTS = [", "const ACHIEVEMENTS = [{ id: 'brand-new' },", 1),
                       encoding='utf-8')
    with pytest.raises(SystemExit, match='1 id'):
        catalog.main(['--check'])
    catalog.main(['--stamp', '29991231000000'])
    written = (migrations / '29991231000000_catalog_ids.sql').read_text(encoding='utf-8')
    assert f"('ach', 'brand-new', '{date.today().isoformat()}')" in written
    assert written.count("('") == 1
    catalog.main(['--check'])   # in step again

    gallery.write_text(js.replace("id: 'ghost'", "id: 'renamed-ghost'", 1), encoding='utf-8')
    with pytest.raises(SystemExit, match='never removed'):
        catalog.main(['--check'])


def test_the_catalog_is_not_backed_up(monkeypatch):
    """The catalog comes from the migrations, so a backup leaves it out (a restore would clash with it)."""
    monkeypatch.syspath_prepend(str(ROOT / 'scripts' / 'accounts'))
    assert 'public.catalog' in importlib.import_module('manage').NOT_BACKED_UP
