"""Terms of Use gate and dataset de-duplication (encryption: test_secure_artifacts.py)."""

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
    _Xd, yd, keep = data.dedupe(X, y)
    assert keep.tolist() == [0, 1, 3] and yd.tolist() == [1, 0, 1]


