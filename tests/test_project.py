"""Terms gate, dataset de-duplication and artifact encryption."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

from kepler_cnn import data, terms

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def fresh_terms(tmp_path, monkeypatch):
    monkeypatch.setattr(terms, 'TERMS_RECORD', tmp_path / '.terms_accepted')
    monkeypatch.setattr(terms, '_accepted', False)
    monkeypatch.delenv(terms.ENV_VAR, raising=False)
    return tmp_path / '.terms_accepted'


def test_terms_required_when_not_accepted(fresh_terms):
    with pytest.raises(terms.TermsNotAcceptedError):
        terms.require_acceptance(interactive=False)
    with pytest.raises(terms.TermsNotAcceptedError):
        terms.ensure_accepted()
    assert not fresh_terms.exists()


def test_terms_accept_via_env_records_version(fresh_terms, monkeypatch):
    monkeypatch.setenv(terms.ENV_VAR, '1')
    assert terms.require_acceptance(interactive=False)
    assert json.loads(fresh_terms.read_text())['version'] == terms.TERMS_VERSION
    terms.ensure_accepted()


def test_outdated_terms_record_is_not_accepted(fresh_terms):
    fresh_terms.write_text(json.dumps({'version': '0.1'}))
    assert not terms.is_accepted()


def test_dedupe_keeps_first_occurrence():
    X = np.array([[1.0, 2.0], [3.0, 4.0], [1.0, 2.000001], [5.0, 6.0]])
    y = np.array([1, 0, 0, 1])
    Xd, yd, keep = data.dedupe(X, y)
    assert keep.tolist() == [0, 1, 3] and yd.tolist() == [1, 0, 1]


@pytest.fixture
def secure(tmp_path, monkeypatch):
    path = ROOT / 'scripts' / 'secure_artifacts.py'
    spec = importlib.util.spec_from_file_location('secure_artifacts', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    monkeypatch.setattr(mod, 'ROOT', tmp_path)
    monkeypatch.setattr(mod, 'KEY_FILE', tmp_path / '.secrets' / 'star_gazer.key')
    monkeypatch.setattr(mod, 'BUNDLE', tmp_path / 'secure' / 'star_gazer_v3.enc')
    monkeypatch.setattr(mod, 'MANIFEST', tmp_path / 'secure' / 'MANIFEST.json')
    monkeypatch.delenv(mod.ENV_VAR, raising=False)
    return mod


def test_encrypt_roundtrip_and_wrong_key(secure, tmp_path, monkeypatch):
    (tmp_path / 'models' / 'v3').mkdir(parents=True)
    (tmp_path / 'results' / 'v3').mkdir(parents=True)
    (tmp_path / 'models' / 'v3' / 'star_gazer.keras').write_bytes(b'weights' * 100)
    (tmp_path / 'results' / 'v3' / 'metrics.json').write_text('{"accuracy": 0.9}')
    secure.keygen(None)
    secure.lock(None)
    blob = secure.BUNDLE.read_bytes()
    assert blob[:4] == secure.MAGIC and b'weights' not in blob

    with pytest.raises(SystemExit):                     # refuses to overwrite existing files
        secure.unlock(type('A', (), {'force': False})())
    for f in ('models/v3/star_gazer.keras', 'results/v3/metrics.json'):
        (tmp_path / f).unlink()
    secure.unlock(type('A', (), {'force': False})())
    assert (tmp_path / 'models' / 'v3' / 'star_gazer.keras').read_bytes() == b'weights' * 100

    import base64
    import os
    monkeypatch.setenv(secure.ENV_VAR, base64.urlsafe_b64encode(os.urandom(32)).decode())
    with pytest.raises(SystemExit, match='Decryption failed'):
        secure.unlock(type('A', (), {'force': True})())
