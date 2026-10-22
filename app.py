"""Star Gazer: a Streamlit demo that classifies any Kepler Object of Interest.

    .venv\\Scripts\\streamlit run app.py                     # local only (http://localhost:8501)
    .venv\\Scripts\\streamlit run app.py -- --model v2       # serve an older model (v2 or v1_5)
    streamlit run app.py --server.address 0.0.0.0          # listen on all interfaces (e.g. a Hugging Face Space)

--model v3 (default when trained) is the Star Gazer hybrid model: all-quarter
global/local views + NASA catalog features (scripts/pipeline/train_star_gazer.py).
--model v2 / v1_5 serve the single-quarter 1D CNN (notebooks/Exoplanet_Detection_V2.ipynb).
Server settings (local address, no error details or usage statistics sent to visitors) are in
.streamlit/config.toml. Streamlit replaced Gradio in October 2026: Gradio would not allow Pillow 13, which
carries security fixes.
"""

import argparse
import math
import sys
import threading
from collections.abc import Callable

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt

from kepler_cnn import config as C
from kepler_cnn import data, plots, saliency, terms
from kepler_cnn import model as M
from kepler_cnn import star_gazer as S

TERMS_LABEL = f'I have read and agree to the Terms of Use (v{terms.TERMS_VERSION})'
DISCLAIMER = '(Model output for education only, not a scientific classification.)'
MAX_WAITING = 20   # visitors allowed to wait for the one prediction that runs at a time

Progress = Callable[[float, str], None]


def _no_progress(fraction: float, text: str) -> None:
    pass


def make_predict_v3(models, pre, threshold, catalog):
    known_kois = set(catalog.kepoi_name)

    def predict(agree, kepoi_name, kepler_id, period, t0, explain=False, progress: Progress = _no_progress):
        if not agree:
            return 'Please read and accept the Terms of Use first.', None, None
        kepoi_name = (kepoi_name or '').strip().upper()
        if not kepoi_name:
            return 'Star Gazer needs a KOI name (it uses the NASA catalog parameters).', None, None
        if kepoi_name not in known_kois:          # validate before the name touches any file path
            return f'Error: {kepoi_name} is not in the NASA KOI catalog (format: K00010.01).', None, None
        progress(0.1, 'Using cached views' if S.views.is_current(kepoi_name)
                 else 'Downloading all Kepler quarters from NASA MAST (~10 s)...')
        try:
            prob, verdict, v, row, inputs = S.predict_koi(models, pre, catalog, kepoi_name, threshold,
                                                          return_inputs=True)
        except (KeyError, RuntimeError) as e:
            return f'Error: {e}', None, None
        progress(0.7, 'Plotting')
        color = C.PLANET_COLOR if verdict == 'PLANET' else C.FP_COLOR
        title = (f'{kepoi_name} (KIC {int(row.kepid)}), catalog: {row.koi_disposition}  |  '
                 f'P(planet) = {prob:.1%} -> {verdict}')
        fig = plots.star_gazer_views(v, title, color)
        sal_fig = None
        if explain:
            progress(0.8, 'Explaining (hiding parts of each view and re-running the model)')
            sal = saliency.explain(models, inputs)
            sal_fig = plots.v3_saliency(v, sal, pre.columns,
                                        f'{kepoi_name}: what drove P(planet) = {prob:.1%}', color)
        return f'{verdict}: P(planet) = {prob:.1%} (threshold {threshold:.2f})\n{DISCLAIMER}', fig, sal_fig
    return predict


def check_manual_inputs(kepler_id, period, t0):
    """Reason the manual inputs are unusable, or None. Keeps nonsense (NaN, huge or negative
    values) away from the MAST download and the phase-folding."""
    values = {'Kepler ID': kepler_id, 'period': period, 'epoch': t0 or 0}
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in values.values()):
        return 'Kepler ID, period and epoch must be finite numbers.'
    if not (1 <= kepler_id <= 100_000_000 and float(kepler_id).is_integer()):
        return 'Kepler ID must be a whole number between 1 and 100,000,000.'
    if not 0.1 <= period <= 2000:
        return 'Period must be between 0.1 and 2,000 days.'
    if not -10_000 <= (t0 or 0) <= 10_000:
        return 'Epoch (BKJD) must be between -10,000 and 10,000.'
    return None


def make_predict_cnn(model, df_koi):
    def predict(agree, kepoi_name, kepler_id, period, t0, explain=False, progress: Progress = _no_progress):
        if not agree:
            return 'Please read and accept the Terms of Use first.', None, None
        kepoi_name = (kepoi_name or '').strip().upper()
        if kepoi_name:
            try:
                row = data.get_koi(df_koi, kepoi_name)
            except KeyError as e:
                return f'Error: {e}', None, None
            kepler_id, period, t0 = row['kepid'], row['koi_period'], row['koi_time0bk']
            title = f'{kepoi_name} (KIC {int(kepler_id)}), catalog: {row["koi_disposition"]}'
        else:
            if not (kepler_id and period):
                return 'Enter a KOI name, or a Kepler ID + period + epoch.', None, None
            problem = check_manual_inputs(kepler_id, period, t0)
            if problem:
                return f'Error: {problem}', None, None
            title = f'KIC {int(kepler_id)}'

        progress(0.1, 'Downloading light curve from NASA MAST...')
        flux = data.download_and_fold(int(kepler_id), float(period), float(t0 or 0))
        progress(0.8, 'Running model')
        flux = data.apply_quality_filters(flux)
        if flux is None:
            return 'Error: could not download or process this light curve.', None, None
        prob, verdict = M.predict_flux(model, flux)
        fig = plots.single_prediction(flux, prob, verdict, title)
        return f'{verdict}: P(planet) = {prob:.1%}\n{DISCLAIMER}', fig, None
    return predict


def parse_args(argv):
    default_model = 'v3' if S.MODEL_FILE.exists() else C.DEFAULT_DATASET
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--model', choices=['v3', *C.DATASETS], default=default_model,
                        help='v3 = Star Gazer (default when trained); v2 / v1_5 = single-quarter CNN')
    parser.add_argument('--allow-stale', action='store_true',
                        help='serve a V3 model trained on an older view recipe anyway (not recommended)')
    return parser.parse_known_args(argv)[0]   # ignore what is not ours (e.g. a test runner's own arguments)


def main():   # run by `streamlit run app.py`; importing this module (the tests) draws nothing
    import streamlit as st

    st.set_page_config(page_title='Star Gazer', page_icon=':material/travel_explore:')
    args = parse_args(sys.argv[1:])
    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        st.error(str(e), title='Terms of Use not accepted on this computer')
        st.stop()

    @st.cache_resource(show_spinner='Loading the model...')
    def load(model_name, allow_stale):
        """The model, once per server (shared by every visitor): (predict, label, manual inputs, can explain)."""
        if model_name == 'v3':
            if not S.MODEL_FILE.exists():
                raise FileNotFoundError(f'No Star Gazer model at {C.rel(S.MODEL_FILE)}. '
                                        'Run scripts/pipeline/train_star_gazer.py first.')
            models, pre, threshold = S.load_trained(allow_stale=allow_stale)
            ensemble = f', ensemble of {len(models)}' if len(models) > 1 else ''
            return (make_predict_v3(models, pre, threshold, S.load_catalog()),
                    f'V3 Star Gazer (all-quarter multi-view CNN + NASA catalog features{ensemble})', False, True)
        C.use_dataset(model_name)
        if not C.MODEL_FILE.exists():
            raise FileNotFoundError(f'No trained model at {C.rel(C.MODEL_FILE)}. Run the V2 notebook with '
                                    f'DATASET = {model_name!r} first.')
        return (make_predict_cnn(M.load_trained_model(), data.load_catalog()),
                f'{model_name} single-quarter 1D CNN', True, False)

    @st.cache_resource
    def gate():
        """One prediction at a time for the whole server (each downloads from NASA and runs the model)."""
        return {'lock': threading.Lock(), 'waiting': 0, 'count': threading.Lock()}

    st.title('Star Gazer')
    st.markdown('Downloads a Kepler light curve from NASA MAST, phase-folds it and asks the model whether '
                'the transit looks like a real planet.')
    try:
        predict, label, manual_inputs, can_explain = load(args.model, args.allow_stale)
    except (FileNotFoundError, S.StaleModelError) as e:
        st.error(str(e), title='No model to serve')
        st.stop()
    st.caption(f'Model: {label}')
    with st.expander('Terms of Use', icon=':material/gavel:'):
        st.markdown(C.TERMS_FILE.read_text(encoding='utf-8'))
    agree = st.checkbox(TERMS_LABEL, key='agree')

    st.session_state.setdefault('kepoi', '')

    def use_example():
        st.session_state.kepoi = st.session_state.example or ''

    st.pills('Example KOIs', C.EXAMPLE_KOIS, key='example', on_change=use_example)
    with st.form('predict'):
        kepoi = st.text_input('KOI name (parameters looked up in the NASA catalog)', key='kepoi',
                              placeholder='e.g. K00010.01', max_chars=12)
        kepler_id = period = t0 = None
        if manual_inputs:
            st.caption('**or** enter values manually:')
            with st.container(horizontal=True):
                kepler_id = st.number_input('Kepler ID (KIC)', value=None, step=1, min_value=1, max_value=100_000_000)
                period = st.number_input('Orbital period (days)', value=None, min_value=0.1, max_value=2000.0)
                t0 = st.number_input('Transit epoch (BKJD)', value=None, min_value=-10_000.0, max_value=10_000.0)
        explain = st.checkbox('Explain this prediction (saliency map, a few seconds more)') if can_explain else False
        submitted = st.form_submit_button('Predict', type='primary', icon=':material/play_arrow:')
    if not submitted:
        return

    g = gate()
    with g['count']:
        if g['waiting'] >= MAX_WAITING:
            st.warning('Too many people are waiting right now. Please try again in a minute.', title='Busy')
            return
        g['waiting'] += 1
    bar = st.progress(0.0, text='Waiting for the model...')
    try:
        with g['lock']:
            text, fig, sal_fig = predict(agree, kepoi, kepler_id, period, t0, explain,
                                         progress=lambda f, t: bar.progress(f, text=t))
    finally:
        with g['count']:
            g['waiting'] -= 1
    bar.empty()
    if fig is None:
        st.error(text)
        return
    (st.success if text.startswith('PLANET') else st.info)(text)
    st.pyplot(fig, alt='Phase-folded light curve views of the Kepler signal')
    plt.close(fig)
    if sal_fig is not None:
        st.subheader('What drove the prediction')
        st.caption('Saliency: blue supports planet, red supports false positive')
        st.pyplot(sal_fig, alt='Saliency map over the light-curve views')
        plt.close(sal_fig)


if __name__ == '__main__':
    main()
