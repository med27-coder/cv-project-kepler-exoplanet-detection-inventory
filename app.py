"""Gradio demo: classify any Kepler Object of Interest with the trained CNN.

    .venv\\Scripts\\python app.py            # local only (http://127.0.0.1:7860)
    .venv\\Scripts\\python app.py --share    # public gradio.live link (see TERMS_OF_USE.md §6)
    .venv\\Scripts\\python app.py --dataset v1_5   # serve the V1.5 Colab model instead

Requires a trained model at models/<dataset>/exoplanet_cnn_model.keras
(the V2 notebook trains and saves it).
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

TERMS_LABEL = f'I have read and agree to the Terms of Use (v{terms.TERMS_VERSION})'


def make_predict(model, df_koi):
    def predict(agree, kepoi_name, kepler_id, period, t0):
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

        flux = data.download_and_fold(int(kepler_id), float(period), float(t0 or 0))
        flux = data.apply_quality_filters(flux)
        if flux is None:
            return 'Error: could not download or process this light curve.', None
        prob, verdict = M.predict_flux(model, flux)
        fig = plots.single_prediction(flux, prob, verdict, title)
        return f'{verdict}: P(planet) = {prob:.1%}\n(Model output for education only, not a scientific classification.)', fig
    return predict


def build_ui(model, df_koi):
    terms_text = C.TERMS_FILE.read_text(encoding='utf-8')
    with gr.Blocks(title='Exoplanet CNN Detector') as demo:
        gr.Markdown('# Exoplanet CNN Detector\n'
                    'Downloads a Kepler light curve from NASA MAST, phase-folds it and '
                    'asks the 1D CNN whether the transit looks like a real planet.')
        with gr.Accordion('Terms of Use', open=False):
            gr.Markdown(terms_text)
        agree = gr.Checkbox(label=TERMS_LABEL, value=False)

        with gr.Row():
            with gr.Column():
                kepoi = gr.Textbox(label='KOI name (period/epoch looked up in the NASA catalog)',
                                   placeholder='e.g. K00010.01')
                gr.Markdown('**or** enter values manually:')
                kepler_id = gr.Number(label='Kepler ID (KIC)', precision=0)
                period = gr.Number(label='Orbital period (days)')
                t0 = gr.Number(label='Transit epoch (BKJD)')
                btn = gr.Button('Predict', variant='primary')
            with gr.Column():
                out_text = gr.Textbox(label='Model prediction', lines=2)
                out_plot = gr.Plot(label='Phase-folded light curve')

        gr.Examples(examples=[[k] for k in C.EXAMPLE_KOIS], inputs=[kepoi],
                    label='Example KOIs')
        btn.click(make_predict(model, df_koi),
                  inputs=[agree, kepoi, kepler_id, period, t0],
                  outputs=[out_text, out_plot])
    return demo


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--share', action='store_true',
                        help='create a public gradio.live link (off by default)')
    parser.add_argument('--port', type=int, default=7860)
    parser.add_argument('--dataset', choices=list(C.DATASETS), default=C.DEFAULT_DATASET,
                        help='which trained model to serve (models/<dataset>/)')
    args = parser.parse_args()
    C.use_dataset(args.dataset)

    try:
        terms.require_acceptance()
    except terms.TermsNotAcceptedError as e:
        sys.exit(str(e))

    if not C.MODEL_FILE.exists():
        sys.exit(f'No trained model at {C.rel(C.MODEL_FILE)}. Run the V2 notebook with '
                 f'DATASET = {args.dataset!r} first (it trains and saves the model).')

    model = M.load_trained_model()
    df_koi = data.load_catalog()
    build_ui(model, df_koi).launch(server_name='127.0.0.1', server_port=args.port, share=args.share)


if __name__ == '__main__':
    main()
