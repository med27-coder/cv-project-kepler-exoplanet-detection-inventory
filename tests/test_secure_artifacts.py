"""Tests for scripts/secure_artifacts.py: split, authenticated, tamper-evident bundles."""

import importlib
import json
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'


@pytest.fixture
def sa(tmp_path, monkeypatch):
    """The module, pointed at a throw-away repo with a fake model and results."""
    monkeypatch.syspath_prepend(str(SCRIPTS))
    mod = importlib.import_module('secure_artifacts')
    monkeypatch.setattr(mod, 'ROOT', tmp_path)
    monkeypatch.setattr(mod, 'KEY_FILE', tmp_path / '.secrets' / 'star_gazer.key')
    monkeypatch.setattr(mod, 'SECURE_DIR', tmp_path / 'secure')
    monkeypatch.setattr(mod, 'MANIFEST', tmp_path / 'secure' / 'MANIFEST.json')
    monkeypatch.setattr(mod, 'PART_BYTES', 4_000)        # force several parts
    monkeypatch.delenv(mod.ENV_VAR, raising=False)
    monkeypatch.delenv(mod.PASS_VAR, raising=False)
    monkeypatch.setattr(mod, 'restrict_permissions', lambda path: None)
    import os
    for rel, size in (('models/v3/star_gazer.keras', 9_000), ('results/v3/metrics.json', 500)):
        f = tmp_path / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(os.urandom(size))                   # incompressible, so it really splits
    return mod


def args(**kw):
    return type('Args', (), {'force': False, 'passphrase': False, **kw})()


def test_lock_unlock_roundtrip_in_parts(sa, tmp_path):
    sa.keygen(args())
    original = (tmp_path / 'models/v3/star_gazer.keras').read_bytes()
    sa.lock(args())
    manifest = json.loads(sa.MANIFEST.read_text())
    assert manifest['format'] == 2 and len(manifest['parts']) >= 3
    assert all(p['bytes'] < 5_000 for p in manifest['parts'])
    for rel in ('models', 'results'):
        import shutil
        shutil.rmtree(tmp_path / rel)
    sa.unlock(args())
    assert (tmp_path / 'models/v3/star_gazer.keras').read_bytes() == original


def test_corrupted_or_missing_part_is_reported(sa):
    sa.keygen(args())
    sa.lock(args())
    first = sa.SECURE_DIR / 'star_gazer_v3.part01.enc'
    blob = bytearray(first.read_bytes())
    blob[-1] ^= 1
    first.write_bytes(bytes(blob))
    with pytest.raises(SystemExit, match='does not match MANIFEST'):
        sa.verify(args())
    first.unlink()
    with pytest.raises(SystemExit, match='Missing part'):
        sa.unlock(args(force=True))


def _refresh_hashes(sa):
    import hashlib
    m = json.loads(sa.MANIFEST.read_text())
    for p in m['parts']:
        p['sha256'] = hashlib.sha256((sa.SECURE_DIR / p['file']).read_bytes()).hexdigest()
    sa.MANIFEST.write_text(json.dumps(m))
    return m


def test_reordered_dropped_or_foreign_parts_fail_authentication(sa):
    """Even with the manifest hashes updated, parts can't be swapped, dropped or mixed."""
    sa.keygen(args())
    sa.lock(args())
    p0, p1 = (sa.SECURE_DIR / f'star_gazer_v3.part0{i}.enc' for i in (0, 1))
    a, b = p0.read_bytes(), p1.read_bytes()
    p0.write_bytes(b)
    p1.write_bytes(a)
    _refresh_hashes(sa)
    with pytest.raises(SystemExit, match='Decryption failed'):
        sa.unlock(args(force=True))
    p0.write_bytes(a)
    p1.write_bytes(b)
    m = _refresh_hashes(sa)
    m['parts'] = m['parts'][:-1]                       # drop the last part
    sa.MANIFEST.write_text(json.dumps(m))
    with pytest.raises(SystemExit, match='Decryption failed'):
        sa.unlock(args(force=True))


def test_manifest_cannot_point_outside_secure_dir(sa):
    sa.keygen(args())
    sa.lock(args())
    m = json.loads(sa.MANIFEST.read_text())
    m['parts'][0]['file'] = '../models/v3/star_gazer.keras'
    sa.MANIFEST.write_text(json.dumps(m))
    with pytest.raises(SystemExit, match='unexpected file'):
        sa.verify(args())


def test_wrong_key_fails(sa, monkeypatch):
    sa.keygen(args())
    sa.lock(args())
    import base64
    import os
    monkeypatch.setenv(sa.ENV_VAR, base64.urlsafe_b64encode(os.urandom(32)).decode())
    with pytest.raises(SystemExit, match='Decryption failed'):
        sa.unlock(args(force=True))


def test_passphrase_protected_key(sa, monkeypatch):
    monkeypatch.setenv(sa.PASS_VAR, 'correct horse battery staple')
    sa.keygen(args(passphrase=True))
    assert sa.KEY_FILE.read_text().lstrip().startswith('{')   # no raw key on disk
    sa.lock(args())
    sa.unlock(args(force=True))
    monkeypatch.setenv(sa.PASS_VAR, 'wrong')
    with pytest.raises(SystemExit, match='Wrong passphrase'):
        sa.load_key()


def test_protect_keeps_the_same_key(sa, monkeypatch):
    sa.keygen(args())
    key = sa.load_key()
    monkeypatch.setenv(sa.PASS_VAR, 'pass phrase')
    sa.protect(args())
    assert sa.load_key() == key


def test_rotate_reencrypts_and_keeps_old_key(sa):
    sa.keygen(args())
    sa.lock(args())
    old_key = sa.load_key()
    sa.rotate(args())
    assert sa.load_key() != old_key
    assert list(sa.KEY_FILE.parent.glob('star_gazer.key.old-*'))
    sa.unlock(args(force=True))                          # new key opens the re-encrypted bundle
    with pytest.raises(SystemExit, match='Decryption failed'):
        sa.decrypt_bundle(old_key)


def test_keygen_refuses_to_overwrite(sa):
    sa.keygen(args())
    with pytest.raises(SystemExit, match='refusing to overwrite'):
        sa.keygen(args())
