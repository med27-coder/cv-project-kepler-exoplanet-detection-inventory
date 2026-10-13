"""Star Gazer: Gradio demo that classifies any Kepler Object of Interest.

    .venv\\Scripts\\python app.py                  # local only (http://127.0.0.1:7860)
    .venv\\Scripts\\python app.py --share          # public gradio.live link (see TERMS_OF_USE.md §6)
    .venv\\Scripts\\python app.py --model v2       # serve an older model (v2 or v1_5)
    python app.py --host 0.0.0.0                 # listen on all interfaces (e.g. a Hugging Face Space)

--model v3 (default when trained) is the Star Gazer hybrid model: all-quarter
global/local views + NASA catalog features (scripts/train_star_gazer.py).
--model v2 / v1_5 serve the single-quarter 1D CNN (notebooks/Exoplanet_Detection_V2.ipynb).
"""

import argparse
import math
import sys

import gradio as gr
import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt

from kepler_cnn import config as C
from kepler_cnn import data, plots, saliency, terms
from kepler_cnn import model as M
from kepler_cnn import star_gazer as S

TERMS_LABEL = f'I have read and agree to the Terms of Use (v{terms.TERMS_VERSION})'
DISCLAIMER = '(Model output for education only, not a scientific classification.)'


def _release(*figs):
    """Drop figures from pyplot's registry; Gradio still renders the Figure objects, but a
    long-running server no longer keeps every figure it ever drew."""
    for fig in figs:
        if fig is not None:
            plt.close(fig)
    return figs


def make_predict_v3(models, pre, threshold, catalog):
    known_kois = set(catalog.kepoi_name)

    # Gradio finds the gr.Progress() default and passes a live tracker per request (its documented API)
    def predict(agree, kepoi_name, kepler_id, period, t0, explain=False, progress=gr.Progress()):  # noqa: B008
        if not agree:
            return 'Please read and accept the Terms of Use first.', None, None
        kepoi_name = (kepoi_name or '').strip().upper()
        if not kepoi_name:
            return 'Star Gazer needs a KOI name (it uses the NASA catalog parameters).', None, None
        if kepoi_name not in known_kois:          # validate before the name touches any file path
            return f'Error: {kepoi_name} is not in the NASA KOI catalog (format: K00010.01).', None, None
        progress(0.1, desc='Using cached views' if S.views.is_current(kepoi_name)
                 else 'Downloading all Kepler quarters from NASA MAST (~10 s)...')
        try:
            prob, verdict, v, row, inputs = S.predict_koi(models, pre, catalog, kepoi_name, threshold,
                                                          return_inputs=True)
        except (KeyError, RuntimeError) as e:
            return f'Error: {e}', None, None
        progress(0.7, desc='Plotting')
        color = C.PLANET_COLOR if verdict == 'PLANET' else C.FP_COLOR
        title = (f'{kepoi_name} (KIC {int(row.kepid)}), catalog: {row.koi_disposition}  |  '
                 f'P(planet) = {prob:.1%} -> {verdict}')
        fig = plots.star_gazer_views(v, title, color)
        sal_fig = None
        if explain:
            progress(0.8, desc='Explaining (hiding parts of each view and re-running the model)')
            sal = saliency.explain(models, inputs)
            sal_fig = plots.v3_saliency(v, sal, pre.columns,
                                        f'{kepoi_name}: what drove P(planet) = {prob:.1%}', color)
        _release(fig, sal_fig)
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
    def predict(agree, kepoi_name, kepler_id, period, t0, progress=gr.Progress()):  # noqa: B008  Gradio injects it
        if not agree:
            return 'Please read and accept the Terms of Use first.', None
        kepoi_name = (kepoi_name or '').strip().upper()
        if kepoi_name:
            try:
                row = data.get_koi(df_koi, kepoi_name)
            except KeyError as e:
                return f'Error: {e}', None
            kepler_id, period, t0 = row['kepid'], row['koi_period'], row['koi_time0bk']
            title = f'{kepoi_name} (KIC {int(kepler_id)}), catalog: {row["koi_disposition"]}'
        else:
            if not (kepler_id and period):
                return 'Enter a KOI name, or a Kepler ID + period + epoch.', None
            problem = check_manual_inputs(kepler_id, period, t0)
            if problem:
                return f'Error: {problem}', None
            title = f'KIC {int(kepler_id)}'

        progress(0.1, desc='Downloading light curve from NASA MAST...')
        flux = data.download_and_fold(int(kepler_id), float(period), float(t0 or 0))
        progress(0.8, desc='Running model')
        flux = data.apply_quality_filters(flux)
        if flux is None:
            return 'Error: could not download or process this light curve.', None
        prob, verdict = M.predict_flux(model, flux)
        fig = plots.single_prediction(flux, prob, verdict, title)
        _release(fig)
        return f'{verdict}: P(planet) = {prob:.1%}\n{DISCLAIMER}', fig
    return predict


def build_ui(predict_fn, model_label, manual_inputs=True, can_explain=False):
    terms_text = C.TERMS_FILE.read_text(encoding='utf-8')
    with gr.Blocks(title='Star Gazer') as demo:
        gr.Markdown('# 🔭 Star Gazer\n'
                    'Downloads a Kepler light curve from NASA MAST, phase-folds it and asks '
                    f'the model whether the transit looks like a real planet.  \n*Model: {model_label}*')
        with gr.Accordion('Terms of Use', open=False):
            gr.Markdown(terms_text)
        agree = gr.Checkbox(label=TERMS_LABEL, value=False)

        with gr.Row():
            with gr.Column():
                kepoi = gr.Textbox(label='KOI name (parameters looked up in the NASA catalog)',
                                   placeholder='e.g. K00010.01')
                with gr.Group(visible=manual_inputs):
                    gr.Markdown('**or** enter values manually:')
                    kepler_id = gr.Number(label='Kepler ID (KIC)', precision=0)
                    period = gr.Number(label='Orbital period (days)')
                    t0 = gr.Number(label='Transit epoch (BKJD)')
                explain = gr.Checkbox(label='Explain this prediction (saliency map, a few seconds more)',
                                      value=False, visible=can_explain)
                btn = gr.Button('Predict', variant='primary')
            with gr.Column():
                out_text = gr.Textbox(label='Model prediction', lines=2)
                out_plot = gr.Plot(label='Phase-folded light curve')
        out_sal = gr.Plot(label='Saliency: blue supports planet, red supports false positive',
                          visible=can_explain)

        gr.Examples(examples=[[k] for k in C.EXAMPLE_KOIS], inputs=[kepoi], label='Example KOIs')
        if can_explain:
            btn.click(predict_fn, inputs=[agree, kepoi, kepler_id, period, t0, explain],
                      outputs=[out_text, out_plot, out_sal])
        else:
            btn.click(predict_fn, inputs=[agree, kepoi, kepler_id, period, t0],
                      outputs=[out_text, out_plot])
    return demo


def main():
    default_model = 'v3' if S.MODEL_FILE.exists() else C.DEFAULT_DATASET
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--share', action='store_true',
                        help='create a public gradio.live link (off by default)')
    parser.add_argument('--port', type=int, default=7860)
    parser.add_argument('--host', default='127.0.0.1',
                        help='interface to listen on (0.0.0.0 on a server such as a Hugging Face Space)')
    parser.add_argument('--model', choices=['v3', *C.DATASETS], default=default_model,
                        help='v3 = Star Gazer (default when trained); v2 / v1_5 = single-quarter CNN')
    parser.add_argument('--allow-stale', action='store_true',
                        help='serve a V3 model trained on an older view recipe anyway (not recommended)')
    args = parser.parse_args()

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))

    if args.model == 'v3':
        if not S.MODEL_FILE.exists():
            sys.exit(f'No Star Gazer model at {C.rel(S.MODEL_FILE)}. '
                     'Run scripts/train_star_gazer.py first.')
        try:
            models, pre, threshold = S.load_trained(allow_stale=args.allow_stale)
        except S.StaleModelError as e:
            sys.exit(f'{e}\n(Use --allow-stale to serve it anyway.)')
        predict = make_predict_v3(models, pre, threshold, S.load_catalog())
        ensemble = f', ensemble of {len(models)}' if len(models) > 1 else ''
        label = f'V3 Star Gazer (all-quarter multi-view CNN + NASA catalog features{ensemble})'
        ui = build_ui(predict, label, manual_inputs=False, can_explain=True)
    else:
        C.use_dataset(args.model)
        if not C.MODEL_FILE.exists():
            sys.exit(f'No trained model at {C.rel(C.MODEL_FILE)}. Run the V2 notebook with '
                     f'DATASET = {args.model!r} first.')
        ui = build_ui(make_predict_cnn(M.load_trained_model(), data.load_catalog()),
                      f'{args.model} single-quarter 1D CNN')
    # Public-facing limits: one prediction at a time (each downloads from MAST and runs the model),
    # a short waiting line, no direct API calls around the queue, no tracebacks shown to visitors.
    ui.queue(default_concurrency_limit=1, max_size=20, api_open=False)
    ui.launch(server_name=args.host, server_port=args.port, share=args.share,
              show_error=False, strict_cors=True, max_file_size='1mb', max_threads=8,
              enable_monitoring=False)


if __name__ == '__main__':
    main()
