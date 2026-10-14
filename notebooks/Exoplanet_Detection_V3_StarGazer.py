# %% [markdown]
# # 🔭 Star Gazer: Exoplanet Detection (V3)
# **All Kepler quarters + AstroNet / ExoMiner-style views + NASA catalog features. Runs locally in VS Code.**
#
# V2 used only the first Kepler quarter of each star, roughly 33–90 days. A planet with a 200-day orbit may not transit even once in that window. Star Gazer uses much more of NASA's public data:
#
# | Change in V3 | Why |
# |---|---|
# | **All ~17 quarters (4 years) per star**, stitched together | Every transit is captured, including long-period planets |
# | **Known transits masked before detrending** | Detrending no longer flattens away part of the transit dip |
# | **Global + local views** (Shallue & Vanderburg 2018): whole orbit (2001 bins) and transit zoom (201 bins, ±2 durations) | The global view shows the whole orbit; the local view shows the transit shape |
# | **Eclipsing-binary views** (as in ExoMiner, Valizadegan et al. 2022): odd vs even transits, secondary-eclipse search, centroid shift | The three most common false-positive signatures, measured by Star Gazer from the raw light curves |
# | **NASA catalog features** (transit fit + stellar parameters) in their own branch | Radius, SNR, stellar density and similar values separate planets from eclipsing binaries |
# | **Augmentation + optional ensemble** | Views are randomly time-reversed during training; `ENSEMBLE > 1` averages several networks |
# | **Every labelled KOI** (7,587 → about 7,400 with usable data) instead of 2,000 per class | More data, using the real class balance |
# | **Train / val / test split by star** | KOIs on the same star share systematics, so they never appear in both training and testing |
# | **Decision threshold chosen on validation** | Not tuned on the test set |
#
# The data comes from `scripts/build_full_dataset.py`, which downloads every quarter from MAST, builds the views and deletes the raw FITS files (a few hours for the full catalog).
#
# **What is *not* used as input:** NASA's dispositions, `koi_score`, the `koi_fpflag_*` flags, `kepler_name` and comments. These are the label, or are derived from it. NASA's own Robovetter diagnostics are excluded too (they are the values NASA uses to assign the label) and only appear in an ablation; Star Gazer's odd/even, secondary and centroid views are its own measurements.
#
# **Before running:** select the `.venv` kernel.

# %% [markdown]
# ## ⚙️ Step 0: Setup & Terms of Use

# %%
# --- Cell 0.1: Imports & project path ---
import json
import sys
import warnings
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / 'src' / 'kepler_cnn').is_dir())
if str(ROOT / 'src') not in sys.path:
    sys.path.insert(0, str(ROOT / 'src'))

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd
from IPython.display import display
from sklearn.metrics import classification_report

from kepler_cnn import config as C
from kepler_cnn import plots, terms, views
from kepler_cnn import star_gazer as S

warnings.filterwarnings('ignore')
matplotlib.rcParams['figure.dpi'] = 110
S.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
print(f'Project root: {ROOT}')

# %%
# --- Cell 0.2: Accept the Terms of Use (read TERMS_OF_USE.md first) ---
ACCEPT_TERMS = False   # <- set to True after reading TERMS_OF_USE.md

print(terms.summary(), end='\n\n')
terms.require_acceptance(accept=ACCEPT_TERMS, interactive=False)

# %%
# --- Cell 0.3: Run settings ---
RETRAIN  = False   # True = train even if models/v3/star_gazer.keras exists
EPOCHS   = 60
ENSEMBLE = 1       # number of networks to average (each adds roughly 15-30 min on CPU)

import tensorflow as tf

print('TensorFlow', tf.__version__)
print('Views cached :', len(list(views.VIEWS_DIR.glob('*.npz'))), '(run scripts/build_full_dataset.py to build them)')
from kepler_cnn.runtime import limit_tf_threads

print('TF threads   :', limit_tf_threads(), '(a third of the cores stay free)')
print('Saved model  :', [f.name for f in S.model_files()] or 'none')

# %% [markdown]
# ## 📥 Step 1: NASA Catalog & All-Quarter Views

# %%
# --- Cell 1.1: Load catalog + views ---
catalog = S.load_catalog()
ds = S.load_dataset(catalog)
y = ds['y']
print(f'{len(y)} labelled KOIs with views on {len(set(ds["groups"]))} stars')
print(f'  confirmed planets : {y.sum()}')
print(f'  false positives   : {(y == 0).sum()}')
print(f'  global view : {ds["global"].shape}')
print(f'  local views : {ds["local"].shape}  channels = {S.LOCAL_CHANNELS}')
print(f'  secondary   : {ds["secondary"].shape}')

# %%
# --- Cell 1.2: All views for a planet and two false positives ---
# K00010.01 = Kepler-8 b (planet); K00827.01 and K00743.01 are NASA false positives
# flagged for a centroid offset and for a secondary eclipse.
for name in ['K00010.01', 'K00827.01', 'K00743.01']:
    disp = catalog.loc[catalog.kepoi_name == name, 'koi_disposition'].iloc[0]
    color = C.PLANET_COLOR if disp == 'CONFIRMED' else C.FP_COLOR
    plots.star_gazer_views(S.views_for_koi(catalog, name), f'{name} | NASA: {disp}', color,
                           S.RESULTS_DIR / f'views_{name}.png')
    plt.show()

# %%
# --- Cell 1.3: Dataset overview ---
plots.v3_dataset_overview(ds['table'], y, S.RESULTS_DIR / 'dataset_overview.png')
plt.show()

# %% [markdown]
# ## 🧾 Step 2: NASA Catalog Features
# These are physical properties from the transit fit and the host star. They are log-scaled, filled with medians where missing, and standardised using the training split only.

# %%
# --- Cell 2: Feature overview ---
display(ds['table'][S.FEATURES].describe().T[['count', 'mean', '50%', 'min', 'max']].round(3))

# %% [markdown]
# ## 🧠 Step 3: Split by Star, Build & Train Star Gazer

# %%
# --- Cell 3.1: Star-grouped split + feature preprocessing ---
tr, va, te = S.split_by_star(y, ds['groups'])
print(f'Train {len(tr)}  Val {len(va)}  Test {len(te)}  (no star appears in more than one split)')
assert not set(ds['groups'][tr]) & set(ds['groups'][te])


# %%
# --- Cell 3.2: Train, or load the saved model(s) ---
def saved_model_is_current():
    try:
        S.check_view_version()
        return True
    except S.StaleModelError as e:
        print(f'{e} Retraining.')
        return False


if S.model_files() and not RETRAIN and saved_model_is_current():
    models, pre, threshold = S.load_trained()
    hist = json.loads(S.HISTORY_FILE.read_text()) if S.HISTORY_FILE.exists() else None
    print(f'Loaded {len(models)} model file(s) from {C.rel(S.MODEL_DIR)} (threshold {threshold:.2f})')
else:
    pre = S.FeaturePreprocessor().fit(ds['table'].iloc[tr])
    feats_tmp = pre.transform(ds['table'])
    models, hist = [], None
    for i in range(ENSEMBLE):
        tf.keras.utils.set_random_seed(C.SEED + i)
        model = S.build_model(n_features=feats_tmp.shape[1])
        if i == 0:
            model.summary(line_length=110)
        print(f'Training network {i + 1}/{ENSEMBLE}')
        h = S.train(model, ds, feats_tmp, tr, va, epochs=EPOCHS, verbose=1, seed=C.SEED + i)  # live progress
        hist = hist or h
        models.append(model)
    _, p_val = S.evaluate(models, ds, feats_tmp, va)
    threshold = S.best_threshold(y[va], p_val)
    S.save_trained(models, pre, hist, threshold)
    print(f'Saved to {C.rel(S.MODEL_DIR)}; threshold chosen on validation = {threshold:.2f}')

feats = pre.transform(ds['table'])

# %%
# --- Cell 3.3: Training history ---
if hist:
    plots.v3_training_history(hist, S.RESULTS_DIR / 'training_history.png')
    plt.show()

# %% [markdown]
# ## 🧪 Step 4: Evaluate on the Held-Out Stars

# %%
# --- Cell 4.1: Test metrics ---
m05, prob = S.evaluate(models, ds, feats, te, threshold=0.5)
mthr = S.metrics(y[te], prob, threshold)
pred = (prob >= threshold).astype(int)

print(f'TEST ({len(te)} KOIs on unseen stars)')
print(f'  AUC        : {mthr["auc"]:.4f}')
print(f'  Accuracy   : {mthr["accuracy"]:.4f} @ val threshold {threshold:.2f}   ({m05["accuracy"]:.4f} @ 0.5)')
print(f'  Precision  : {mthr["precision"]:.4f}')
print(f'  Recall     : {mthr["recall"]:.4f}')
print()
print(classification_report(y[te], pred, target_names=['False Positive', 'Confirmed Planet']))

# %%
# --- Cell 4.2: Confusion matrix, ROC, PR, score distributions, calibration, threshold ---
plots.v3_evaluation(y[te], prob, threshold, S.RESULTS_DIR / 'evaluation.png')
plt.show()

# %% [markdown]
# **Where does it go wrong?** The left panel splits the test false positives by the reason NASA rejected them (these flags are used only for this analysis, never as model inputs). The other panels show accuracy by orbital period and by transit signal-to-noise: weak, long-period signals are the hardest.

# %%
# --- Cell 4.2b: Breakdown by false-positive type, period and SNR ---
plots.v3_breakdown(ds['table'].iloc[te].reset_index(drop=True), y[te], prob, threshold,
                   S.RESULTS_DIR / 'breakdown.png')
plt.show()

# %%
# --- Cell 4.3: Version comparison ---
summary = pd.DataFrame({
    'Target':  ['>80%', '>0.85', '>80%', '>80%'],
    'V1':      ['59.38%', '0.573', '59.57%', '80.00%'],
    'V1.5':    ['70.44%', '0.771', '72.73%', '73.56%'],
    'V2':      ['73.32%', '0.830', '73.84%', '71.55%'],
    'V3 Star Gazer': [f'{mthr["accuracy"]:.2%}', f'{mthr["auc"]:.3f}',
                      f'{mthr["precision"]:.2%}', f'{mthr["recall"]:.2%}'],
}, index=['Accuracy', 'AUC', 'Precision', 'Recall'])
display(summary)

# %% [markdown]
# ### Ablation: which inputs matter?
# `scripts/train_star_gazer.py --diagnostics` trains every variant on this same split and writes `results/v3/metrics.json`.

# %%
# --- Cell 4.4: Ablation table (from scripts/train_star_gazer.py) ---
mfile = S.RESULTS_DIR / 'metrics.json'
if mfile.exists():
    res = json.loads(mfile.read_text())['results']
    labels = {'cnn_basic': 'Global + local views only (AstroNet baseline)',
              'cnn': 'All light-curve views (+ odd/even, secondary, centroid)',
              'features': 'NASA catalog features only',
              'hybrid': 'Star Gazer (CNN + features)',
              'hybrid+diagnostics': '+ Robovetter diagnostics (partly circular)'}
    display(pd.DataFrame({labels.get(k, k): {'Accuracy': f'{v["threshold_val"]["accuracy"]:.2%}',
                                            'AUC': f'{v["threshold_val"]["auc"]:.3f}',
                                            'Precision': f'{v["threshold_val"]["precision"]:.2%}',
                                            'Recall': f'{v["threshold_val"]["recall"]:.2%}'}
                          for k, v in res.items()}).T)
    plots.v3_ablation(res, labels={k: v.replace(' (', '\n(') for k, v in labels.items()})
    plt.show()
else:
    print('Run scripts/train_star_gazer.py to produce the ablation table.')

# %% [markdown]
# ## 🔮 Step 5: Predictions

# %%
# --- Cell 5.1: Most confident mistakes on the test set, with all their views ---
plots.v3_mistakes(lambda i: S.row_views(ds, te[i]), ds['names'][te], y[te], prob, n=5,
                  path=S.RESULTS_DIR / 'mistakes.png')
plt.show()

# %%
# --- Cell 5.2: Predict any KOI by name (builds views from MAST if not cached) ---
KOI = 'K00010.01'   # <- edit me (Kepler-8 b)

p, verdict, v, row = S.predict_koi(models, pre, catalog, KOI, threshold)
color = C.PLANET_COLOR if verdict == 'PLANET' else C.FP_COLOR
plots.star_gazer_views(v, f'{KOI}: P(planet) = {p:.1%} -> {verdict}  |  NASA: {row.koi_disposition}', color)
plt.show()

# %% [markdown]
# ## 🌐 Step 6: Web Demo
# ```powershell
# .venv\Scripts\python app.py          # serves Star Gazer (V3) once models/v3/ exists
# .venv\Scripts\python app.py --model v2
# ```
