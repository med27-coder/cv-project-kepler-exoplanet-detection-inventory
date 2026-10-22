"""The Star Gazer demo (app.py, Streamlit): input checks that keep bad values away from downloads and file paths,
and the page itself, run headless with Streamlit's own test harness (no browser)."""

import math
from pathlib import Path

import pytest

app = pytest.importorskip('app')
AppTest = pytest.importorskip('streamlit.testing.v1').AppTest
APP = str(Path(__file__).resolve().parents[1] / 'app.py')


@pytest.mark.parametrize('kepler_id, period, t0', [
    (11442793, 7.0, 131.5),
    (757450, 0.1, None),          # epoch optional
    (1, 2000, -10_000),
])
def test_manual_inputs_accepted(kepler_id, period, t0):
    assert app.check_manual_inputs(kepler_id, period, t0) is None


@pytest.mark.parametrize('kepler_id, period, t0', [
    (math.nan, 7.0, 0),
    (11442793, math.inf, 0),
    (11442793, 7.0, -math.inf),
    (-5, 7.0, 0),
    (1.5, 7.0, 0),                # Kepler IDs are whole numbers
    (10**12, 7.0, 0),
    (11442793, 0.0, 0),
    (11442793, 1e9, 0),
    (11442793, 7.0, 1e12),
    ('11442793', 7.0, 0),         # only numbers, never strings
])
def test_manual_inputs_rejected(kepler_id, period, t0):
    assert app.check_manual_inputs(kepler_id, period, t0)


def test_importing_the_app_draws_nothing():
    """The page is built only under `streamlit run`, so the tests (and tools) can import its checks."""
    assert callable(app.main) and app.MAX_WAITING > 0


def test_page_without_a_model_explains_instead_of_crashing(monkeypatch, tmp_path):
    """With no trained model (as on GitHub's CI), the page says what to run instead of showing a traceback."""
    monkeypatch.setenv('KEPLER_ACCEPT_TERMS', '1')
    monkeypatch.setattr(app.S, 'MODEL_FILE', tmp_path / 'missing.keras')
    monkeypatch.setattr(app.C, 'MODEL_FILE', tmp_path / 'missing_v2.keras')
    monkeypatch.setattr(app.C, 'use_dataset', lambda name: None)
    at = AppTest.from_file(APP, default_timeout=120).run()
    assert not at.exception
    assert at.title[0].value == 'Star Gazer'
    assert at.error and 'No trained model' in at.error[0].value


@pytest.mark.skipif(not app.S.MODEL_FILE.exists(), reason='needs the trained V3 model (git-ignored)')
def test_prediction_needs_the_terms_ticked(monkeypatch):
    """Predicting without ticking the Terms of Use answers with a reminder and downloads nothing."""
    monkeypatch.setenv('KEPLER_ACCEPT_TERMS', '1')
    at = AppTest.from_file(APP, default_timeout=300).run()
    at.session_state['kepoi'] = 'K00010.01'
    at.form_submit_button[0].click().run()
    assert not at.exception
    assert at.error and 'Terms of Use' in at.error[0].value
    assert not at.success and not at.get('imgs')
