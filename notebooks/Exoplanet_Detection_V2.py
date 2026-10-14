# %% [markdown]
# # 🪐 Exoplanet Detection with Kepler Light Curves (V2)
# **NASA Kepler data + AstroNet-style 1D CNN. Runs locally in VS Code.**
#
# V2 combines two things:
# - **The larger dataset from the V2 Colab draft** (`notebooks/archive_colab/Exoplanet_Detection_V2_colab_draft.ipynb`, originally titled "V3"). It sampled 2,000 KOIs per class, which gave 3,576 unique usable light curves, about 4.5× V1.5.
# - **A local VS Code version of the V1.5 pipeline and model.** The light-curve processing and CNN are unchanged, so results can be compared directly.
#
# Set `DATASET = 'v1_5'` in Cell 0.3 to reproduce V1.5 with its 794-curve dataset and Colab model.
#
# | Changed in V2 | Why |
# |---|---|
# | No Google Drive or `!pip`. Paths come from `src/kepler_cnn/config.py` | Runs from any local clone |
# | Real parallel downloads with a per-KOI cache in `data/interim/flux/` | V1.5 waited on each download before starting the next. V2 runs in parallel, and an interrupted run resumes where it stopped |
# | 3,576-curve dataset by default (`DATASET = 'v2'`), with duplicate rows removed | More data. The Colab arrays contained 624 repeated rows; a repeat can fall in both train and test and inflate the score |
# | Reuses Colab files (`X_raw.npy` → v2, `X_lightcurves.npy` + `.keras` model → v1_5) | No need to download everything again (see `scripts/import_colab_checkpoints.py`) |
# | Decision-threshold analysis (from the Colab draft) | Shows how precision and recall trade off as the cut-off changes from 0.5 |
# | Example KOIs are looked up in the NASA catalog | V1.5 hard-coded period/epoch values that did not match the catalog, and two "false positive" examples were actually confirmed planets |
# | Evaluation plots use the same filtered test set as the metrics | Fixes a mismatch between `y_test` and `y_test_eval` in V1.5 |
# | Terms of Use gate | See `TERMS_OF_USE.md` |
# | Gradio demo moved to `app.py` | A blocking server doesn't belong in a notebook cell |
#
# **Before running:** select the `.venv` kernel (top right ▸ *Select Kernel* ▸ *Python Environments* ▸ `.venv`).

# %% [markdown]
# ## 📚 Data Sources
#
# No data files are committed to this repository. Everything is downloaded once and cached under `data/`.
#
# | # | Dataset | Source | Loaded by |
# |---|---------|--------|-----------|
# | 1 | **NASA KOI Cumulative Table** (labels, period, epoch) | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) (TAP API) | `data.load_catalog()` → `data/raw/nasa_koi_catalog.csv` |
# | 2 | **Kepler light curves** (long cadence photometry) | [NASA MAST](https://mast.stsci.edu/) via [`lightkurve`](https://docs.lightkurve.org/) | `data.get_dataset()` → `data/interim/flux/`, `data/processed/` |

# %% [markdown]
# ## ⚙️ Step 0: Setup

# %%
# --- Cell 0.1: Imports & project path ---
import sys
from pathlib import Path

# Find the repo root (the folder with src/kepler_cnn) whatever the notebook's working dir is.
ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / 'src' / 'kepler_cnn').is_dir())
if str(ROOT / 'src') not in sys.path:
    sys.path.insert(0, str(ROOT / 'src'))

import warnings

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from IPython.display import display
from sklearn.metrics import classification_report

from kepler_cnn import config as C
from kepler_cnn import data, plots, terms
from kepler_cnn import model as M

warnings.filterwarnings('ignore')
matplotlib.rcParams['figure.dpi'] = 110
C.ensure_dirs()
print(f'Project root: {ROOT}')

# %% [markdown]
# ### 📜 Terms of Use
# Read [`TERMS_OF_USE.md`](../TERMS_OF_USE.md). If you agree, set `ACCEPT_TERMS = True` and run the cell. Your acceptance is saved in `.terms_accepted`, so you only need to do this once per version. Data download, training and prediction will not run until the Terms are accepted.

# %%
# --- Cell 0.2: Accept the Terms of Use ---
ACCEPT_TERMS = False   # <- set to True after reading TERMS_OF_USE.md

print(terms.summary(), end='\n\n')
terms.require_acceptance(accept=ACCEPT_TERMS, interactive=False)

# %%
# --- Cell 0.3: Run settings ---
DATASET         = 'v2'   # 'v2' = 3,576 curves (default) | 'v1_5' = 794 curves + the V1.5 Colab model
REBUILD_DATASET = False  # True = ignore data/processed/ and rebuild X/y from the per-KOI cache / MAST
RETRAIN         = False  # True = train even if models/<DATASET>/exoplanet_cnn_model.keras already exists
WORKERS         = 8      # parallel MAST downloads (keep it modest, see Terms §3)
EPOCHS          = 60

C.use_dataset(DATASET)
C.ensure_dirs()

import tensorflow as tf

print(f'Dataset        : {DATASET}  ({C.N_PER_CLASS} KOIs sampled per class)')
print('TensorFlow', tf.__version__, '| GPUs:', tf.config.list_physical_devices('GPU') or 'none (CPU is fine for this model)')
print('Cached dataset :', C.X_FILE.exists())
print('Saved model    :', C.MODEL_FILE.exists())

# %% [markdown]
# ## 📥 Step 1: NASA KOI Catalog (Labels)

# %%
# --- Cell 1: Load the KOI catalog (downloaded once to data/raw/) ---
df_koi = data.load_catalog()
print(f'{len(df_koi)} KOI entries')
print(df_koi['koi_disposition'].value_counts().to_string())
display(df_koi.head())

# %% [markdown]
# ## ⚖️ Step 2: Balanced Sample + EDA
# Sampling depends on the dataset: `v2` takes 2,000 per class and `v1_5` takes 500 per class, both with `random_state=42`. This step only matters when the dataset is rebuilt from MAST. With the imported Colab arrays it is used for the EDA plot.

# %%
# --- Cell 2.1: Balanced sample ---
df_dataset = data.select_balanced(df_koi)
print(f'{len(df_dataset)} KOIs selected ({(df_dataset.label == 1).sum()} planets, '
      f'{(df_dataset.label == 0).sum()} false positives)')

# %%
# --- Cell 2.2: Physical properties (log scale) ---
plots.physical_properties(df_dataset)
plt.show()

# %% [markdown]
# ## 🔭 Step 3: Example Light Curves

# %%
# --- Cell 3: Download, fold and plot the example KOIs (period/epoch come from the catalog) ---
examples = []
for kepoi_name, nickname in C.EXAMPLE_KOIS.items():
    row = data.get_koi(df_koi, kepoi_name)
    label = 1 if row['koi_disposition'] == 'CONFIRMED' else 0
    print(f'Fetching {nickname} ({kepoi_name}, KIC {row.kepid}, P={row.koi_period:.3f} d)...')
    flux = data.download_and_fold(row['kepid'], row['koi_period'], row['koi_time0bk'])
    examples.append((f'{nickname}  |  {row["koi_disposition"]}', label, flux))

plots.example_curves(examples)
plt.show()

# %% [markdown]
# ## 📊 Step 4: Build the Training Dataset
#
# The cell checks these sources in order:
# 1. `data/processed/<DATASET>/X_lightcurves.npy` + `y_labels.npy`. These can be your arrays from Colab, imported with `scripts/import_colab_checkpoints.py`.
# 2. The per-KOI cache in `data/interim/flux/`. Only missing KOIs are downloaded.
# 3. NASA MAST. Expect roughly 10–30 min for `v1_5` and about 1 hour for `v2`. If you interrupt it, re-running resumes where it stopped.

# %%
# --- Cell 4.1: Load or build X / y ---
X, y, index_df = data.get_dataset(df_dataset, rebuild=REBUILD_DATASET, workers=WORKERS)
print(f'X shape: {X.shape}  |  planets: {int(y.sum())}  |  false positives: {int((y == 0).sum())}')

# %%
# --- Cell 4.2: Class balance ---
plots.class_balance(y)
plt.show()

# %% [markdown]
# ## 🧠 Step 5: Build & Train the 1D CNN
#
# Architecture (unchanged from V1.5): 4 × [Conv1D(k=5) → BatchNorm → ReLU → MaxPool] with 16→32→64→128 filters, then Dense 512 (dropout 0.5) → Dense 256 (dropout 0.3) → sigmoid. Training uses Adam (1e-4), early stopping on validation AUC (patience 8), and a 68 / 12 / 20 stratified split.
#
# > Models are stored per dataset in `models/<DATASET>/`. The `v2` model trains in about a minute on CPU the first time you run this notebook. `v1_5` loads the model trained on Colab.
# >
# > If you load a model trained on Colab, use the Colab `X`/`y` arrays too. The split is deterministic, so the test set is then the same one the model never saw. With a freshly rebuilt dataset, retrain (`RETRAIN = True`) to avoid test-set leakage.

# %%
# --- Cell 5.1: Split ---
M.set_seed()
X_train, X_val, X_test, y_train, y_val, y_test = M.split(X, y)
print(f'Train: {len(X_train)}  Val: {len(X_val)}  Test: {len(X_test)}')

# %%
# --- Cell 5.2: Train, or load the saved model ---
if C.MODEL_FILE.exists() and not RETRAIN:
    model = M.load_trained_model()
    hist = M.load_history()
    if hist is None:
        print('No training_history.json found (e.g. model imported from Colab); history plots will be skipped.')
else:
    model = M.build_model()
    model.summary()
    hist = M.train(model, X_train, y_train, X_val, y_val, epochs=EPOCHS)
    M.save_model(model)

# %% [markdown]
# ## 📈 Step 6: Training History

# %%
# --- Cell 6: Loss / accuracy / AUC per epoch ---
if hist:
    plots.training_history(hist)
    plt.show()
else:
    print('Skipped: no training history available.')

# %% [markdown]
# ## 🧪 Step 7: Evaluate on the Test Set

# %%
# --- Cell 7.1: Test metrics + classification report ---
metrics, y_prob, y_pred = M.evaluate(model, X_test, y_test)

print('TEST RESULTS')
print('=' * 40)
for k in ['loss', 'accuracy', 'auc', 'precision', 'recall']:
    print(f'  {k:12s}: {metrics[k]:.4f}')
print(f'  {"ms / curve":12s}: {metrics["ms_per_curve"]:.1f}')
print()
print(classification_report(y_test, y_pred, labels=[0, 1],
                            target_names=['False Positive', 'Confirmed Planet']))

# %%
# --- Cell 7.2: Confusion matrix, ROC, precision-recall ---
plots.evaluation(y_test, y_prob, y_pred)
plt.show()

# %%
# --- Cell 7.2b: Decision threshold (ported from the V2 Colab draft) ---
# 0.5 is an arbitrary cut-off. Sweep it to see the precision / recall trade-off.
from sklearn.metrics import f1_score, precision_score, recall_score

thresholds = np.round(np.linspace(0.05, 0.95, 91), 2)
scores = pd.DataFrame({
    'precision': [precision_score(y_test, y_prob >= t, zero_division=0) for t in thresholds],
    'recall':    [recall_score(y_test, y_prob >= t) for t in thresholds],
    'f1':        [f1_score(y_test, y_prob >= t) for t in thresholds],
    'accuracy':  [((y_prob >= t) == y_test).mean() for t in thresholds],
}, index=thresholds)

fig, ax = plt.subplots(figsize=(10, 4))
scores.plot(ax=ax, lw=2)
ax.axvline(C.THRESHOLD, color='gray', ls='--', lw=1, label='default 0.5')
ax.set(xlabel='Decision threshold', ylabel='Score', title='Metrics vs. decision threshold')
ax.grid(True, alpha=0.3)
ax.legend()
fig.savefig(C.RESULTS_DIR / 'threshold_analysis.png', bbox_inches='tight', dpi=120)
plt.show()

best = scores['f1'].idxmax()
print(f'Default 0.50 -> F1={scores.f1[0.5]:.3f}, precision={scores.precision[0.5]:.3f}, recall={scores.recall[0.5]:.3f}')
print(f'Best F1 {best:.2f} -> F1={scores.f1[best]:.3f}, precision={scores.precision[best]:.3f}, recall={scores.recall[best]:.3f}')
print('(Choose a threshold on the validation set, not the test set, before reporting it.)')

# %%
# --- Cell 7.3: Targets vs. previous versions ---
summary = pd.DataFrame({
    'Target':           ['>80%', '>0.85', '>80%', '>80%'],
    'V1':               ['59.38%', '0.573', '59.57%', '80.00%'],
    'V1.5':             ['70.44%', '0.771', '72.73%', '73.56%'],
    'V2 Colab draft':   ['74.13%', '0.824', '74.21%', '73.16%'],
    f'This run ({DATASET})': [f'{metrics["accuracy"]:.2%}', f'{metrics["auc"]:.3f}',
                              f'{metrics["precision"]:.2%}', f'{metrics["recall"]:.2%}'],
}, index=['Accuracy', 'AUC', 'Precision', 'Recall'])
display(summary)

(C.RESULTS_DIR / 'metrics.json').write_text(pd.Series(metrics).to_json(indent=2))
print(f'Saved metrics to {C.rel(C.RESULTS_DIR / "metrics.json")}')

# %%
# --- Cell 7.4: Before vs. after training (untrained baseline) ---
untrained = M.build_model()
before = untrained.evaluate(X_test, y_test, verbose=0, return_dict=True)

print(f'{"Metric":<12} | {"Untrained":>10} | {"Trained":>10}')
print('-' * 38)
for k, label in [('accuracy', 'Accuracy'), ('auc', 'AUC'), ('loss', 'Loss')]:
    print(f'{label:<12} | {before[k]:>10.3f} | {metrics[k]:>10.3f}')

# %%
# --- Cell 7.5: Train vs. validation vs. test ---
if hist:
    plots.train_test_comparison(hist, metrics)
    plt.show()

# %% [markdown]
# ## 🔮 Step 8: Individual Predictions

# %%
# --- Cell 8.1: Test set, 4 correct + 4 wrong ---
plots.prediction_grid(X_test, y_test, y_prob, y_pred,
                      'Model Predictions on Test Light Curves', 'predictions_examples.png')
plt.show()

# %%
# --- Cell 8.2: Training set, same view (shows how well it fits seen data) ---
y_prob_train = model.predict(X_train, verbose=0).flatten()
y_pred_train = (y_prob_train >= C.THRESHOLD).astype(int)
plots.prediction_grid(X_train, y_train, y_prob_train, y_pred_train,
                      'Model Predictions on Training Light Curves', 'training_predictions_examples.png')
plt.show()

# %% [markdown]
# ## 🚀 Step 9: Predict Any KOI
# Enter a KOI name; its period and epoch are taken from the catalog. Example: `K00010.01` (Kepler-8 b). Browse names at the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/cgi-bin/TblView/nph-tblView?app=ExoTbls&config=cumulative).

# %%
# --- Cell 9: Single prediction ---
KOI = 'K00010.01'   # <- edit me (Kepler-8 b)

row = data.get_koi(df_koi, KOI)
flux = data.apply_quality_filters(
    data.download_and_fold(row['kepid'], row['koi_period'], row['koi_time0bk']))
if flux is None:
    print(f'Could not download or process the light curve for {KOI}')
else:
    prob, verdict = M.predict_flux(model, flux)
    plots.single_prediction(flux, prob, verdict, f'{KOI} (catalog: {row["koi_disposition"]})')
    plt.show()
    print(f'P(planet) = {prob:.4f}  ->  {verdict}   |  NASA disposition: {row["koi_disposition"]}')

# %% [markdown]
# ## 🌐 Step 10: Web Demo
# The Gradio app is in `app.py`. Start it from the VS Code terminal:
#
# ```powershell
# .venv\Scripts\python app.py           # http://127.0.0.1:7860 (local only)
# .venv\Scripts\python app.py --share   # temporary public link (read Terms §6 first)
# ```
#
# You can also use **Run and Debug ▸ "Gradio app (local)"**.
#
# All figures from this notebook are saved in `results/v2/`.
