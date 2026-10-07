"""Star Gazer: Gradio demo that classifies any Kepler Object of Interest.

    .venv\\Scripts\\python app.py                  # local only (http://127.0.0.1:7860)
    .venv\\Scripts\\python app.py --share          # public gradio.live link (see TERMS_OF_USE.md §6)
    .venv\\Scripts\\python app.py --model v2       # serve an older model (v2 or v1_5)

--model v3 (default when trained) is the Star Gazer hybrid model: all-quarter
global/local views + NASA catalog features (scripts/train_star_gazer.py).
--model v2 / v1_5 serve the single-quarter 1D CNN (notebooks/Exoplanet_Detection_V2.ipynb).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'src'))

import gradio as gr
import matplotlib

matplotlib.use('Agg')

from kepler_cnn import config as C
from kepler_cnn import data, model as M, plots, terms
from kepler_cnn import star_gazer as S

TERMS_LABEL = f'I have read and agree to the Terms of Use (v{terms.TERMS_VERSION})'
DISCLAIMER = '(Model output for education only, not a scientific classification.)'


def make_predict_v3(models, pre, threshold, catalog):
    def predict(agree, kepoi_name, kepler_id, period, t0, progress=gr.Progress()):
        if not agree:
            return 'Please read and accept the Terms of Use first.', None
        kepoi_name = (kepoi_name or '').strip().upper()
        if not kepoi_name:
            return 'Star Gazer needs a KOI name (it uses the NASA catalog parameters).', None
        progress(0.1, desc='Using cached views' if S.views.is_current(kepoi_name)
                 else 'Downloading all Kepler quarters from NASA MAST (~10 s)...')
        try:
            prob, verdict, v, row = S.predict_koi(models, pre, catalog, kepoi_name, threshold)
        except (KeyError, RuntimeError) as e:
            return f'Error: {e}', None
        progress(0.9, desc='Plotting')
        color = C.PLANET_COLOR if verdict == 'PLANET' else C.FP_COLOR
        title = (f'{kepoi_name} (KIC {int(row.kepid)}), catalog: {row.koi_disposition}  |  '
                 f'P(planet) = {prob:.1%} -> {verdict}')
        fig = plots.star_gazer_views(v, title, color)
        return f'{verdict}: P(planet) = {prob:.1%} (threshold {threshold:.2f})\n{DISCLAIMER}', fig
    return predict


def make_predict_cnn(model, df_koi):
    def predict(agree, kepoi_name, kepler_id, period, t0, progress=gr.Progress()):
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
            title = f'KIC {int(kepler_id)}'

        progress(0.1, desc='Downloading light curve from NASA MAST...')
        flux = data.download_and_fold(int(kepler_id), float(period), float(t0 or 0))
        progress(0.8, desc='Running model')
        flux = data.apply_quality_filters(flux)
        if flux is None:
            return 'Error: could not download or process this light curve.', None
        prob, verdict = M.predict_flux(model, flux)
        fig = plots.single_prediction(flux, prob, verdict, title)
        return f'{verdict}: P(planet) = {prob:.1%}\n{DISCLAIMER}', fig
    return predict


def build_ui(predict_fn, model_label, manual_inputs=True):
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
                btn = gr.Button('Predict', variant='primary')
            with gr.Column():
                out_text = gr.Textbox(label='Model prediction', lines=2)
                out_plot = gr.Plot(label='Phase-folded light curve')

        gr.Examples(examples=[[k] for k in C.EXAMPLE_KOIS], inputs=[kepoi], label='Example KOIs')
        btn.click(predict_fn, inputs=[agree, kepoi, kepler_id, period, t0],
                  outputs=[out_text, out_plot])
    return demo


def main():
    default_model = 'v3' if S.MODEL_FILE.exists() else C.DEFAULT_DATASET
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--share', action='store_true',
                        help='create a public gradio.live link (off by default)')
    parser.add_argument('--port', type=int, default=7860)
    parser.add_argument('--model', choices=['v3', *C.DATASETS], default=default_model,
                        help='v3 = Star Gazer (default when trained); v2 / v1_5 = single-quarter CNN')
    args = parser.parse_args()

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))

    if args.model == 'v3':
        if not S.MODEL_FILE.exists():
            sys.exit(f'No Star Gazer model at {C.rel(S.MODEL_FILE)}. '
                     'Run scripts/train_star_gazer.py first.')
        models, pre, threshold = S.load_trained()
        predict = make_predict_v3(models, pre, threshold, S.load_catalog())
        ensemble = f', ensemble of {len(models)}' if len(models) > 1 else ''
        label = f'V3 Star Gazer (all-quarter multi-view CNN + NASA catalog features{ensemble})'
        ui = build_ui(predict, label, manual_inputs=False)
    else:
        C.use_dataset(args.model)
        if not C.MODEL_FILE.exists():
            sys.exit(f'No trained model at {C.rel(C.MODEL_FILE)}. Run the V2 notebook with '
                     f'DATASET = {args.model!r} first.')
        ui = build_ui(make_predict_cnn(M.load_trained_model(), data.load_catalog()),
                      f'{args.model} single-quarter 1D CNN')
    ui.launch(server_name='127.0.0.1', server_port=args.port, share=args.share)


if __name__ == '__main__':
    main()
