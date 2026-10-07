"""Project paths and constants. Every path is resolved from the repo root,
so code behaves the same from a notebook, a script, or the VS Code debugger."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# --- Folders ---------------------------------------------------------------
DATA_DIR       = PROJECT_ROOT / 'data'
RAW_DIR        = DATA_DIR / 'raw'          # NASA KOI catalog CSV
PROCESSED_DIR  = DATA_DIR / 'processed'    # one sub-folder per dataset (see DATASETS)
FLUX_CACHE_DIR = DATA_DIR / 'interim' / 'flux'  # one .npy per KOI (resumable downloads)
MODELS_DIR     = PROJECT_ROOT / 'models'

# --- Datasets ----------------------------------------------------------------
# v2:   the larger run started on Colab as "V3" (2,000 KOIs sampled per class,
#       3,576 usable curves after removing duplicate rows). Default.
# v1_5: the 794-curve V1.5 run (500 per class), kept to reproduce the reported V1.5 metrics.
DATASETS = {
    'v2':   {'n_per_class': 2000},
    'v1_5': {'n_per_class': 500},
}
DEFAULT_DATASET = 'v2'

# --- Files -----------------------------------------------------------------
CATALOG_FILE  = RAW_DIR / 'nasa_koi_catalog.csv'
FAILED_FILE   = FLUX_CACHE_DIR / '_failed.txt'
TERMS_FILE    = PROJECT_ROOT / 'TERMS_OF_USE.md'
TERMS_RECORD  = PROJECT_ROOT / '.terms_accepted'

# Set by use_dataset() below.
DATASET = X_FILE = Y_FILE = INDEX_FILE = MODEL_FILE = HISTORY_FILE = RESULTS_DIR = None
N_PER_CLASS = None


def use_dataset(name=DEFAULT_DATASET):
    """Point the data / model / results paths at one dataset ('v2' or 'v1_5')."""
    global DATASET, X_FILE, Y_FILE, INDEX_FILE, MODEL_FILE, HISTORY_FILE, RESULTS_DIR, N_PER_CLASS
    if name not in DATASETS:
        raise ValueError(f'Unknown dataset {name!r}; choose from {list(DATASETS)}')
    DATASET      = name
    X_FILE       = PROCESSED_DIR / name / 'X_lightcurves.npy'
    Y_FILE       = PROCESSED_DIR / name / 'y_labels.npy'
    INDEX_FILE   = PROCESSED_DIR / name / 'dataset_index.csv'   # which KOI each row of X is
    MODEL_FILE   = MODELS_DIR / name / 'exoplanet_cnn_model.keras'
    HISTORY_FILE = MODELS_DIR / name / 'training_history.json'
    RESULTS_DIR  = PROJECT_ROOT / 'results' / ('v2' if name == 'v2' else f'{name}_local')
    N_PER_CLASS  = DATASETS[name]['n_per_class']
    return name


# --- Data source -----------------------------------------------------------
# DATA SOURCE 1: NASA Exoplanet Archive, KOI cumulative table.
# TAP is the current interface; the legacy NStED API is kept as a fallback.
CATALOG_COLUMNS = ['kepid', 'kepoi_name', 'kepler_name', 'koi_disposition',
                   'koi_period', 'koi_time0bk', 'koi_duration', 'koi_depth', 'koi_prad']
CATALOG_URLS = [
    'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+'
    + ','.join(CATALOG_COLUMNS) + '+from+cumulative&format=csv',
    'https://exoplanetarchive.ipac.caltech.edu/cgi-bin/nstedAPI/nph-nstedAPI'
    '?table=cumulative&select=' + ','.join(CATALOG_COLUMNS) + '&format=csv',
]

# --- Pipeline settings (same as V1.5 / Colab so cached arrays stay compatible)
BINS        = 201
SEED        = 42
THRESHOLD   = 0.5

# Example KOIs, looked up in the catalog by name (V1/V1.5 hard-coded
# period/epoch values that did not match the catalog). All four have periods
# short enough to be folded from the single Kepler quarter the pipeline downloads.
EXAMPLE_KOIS = {
    'K00010.01': 'Kepler-8 b',
    'K00069.01': 'Kepler-93 b',
    'K00114.01': 'KOI-114.01',
    'K00340.01': 'KOI-340.01',
}

# --- Plot colours ------------------------------------------------------------
PLANET_COLOR = '#2196F3'
FP_COLOR     = '#F44336'
CORRECT_COLOR = '#4CAF50'
WRONG_COLOR   = '#FF5722'


def ensure_dirs():
    for d in (RAW_DIR, X_FILE.parent, FLUX_CACHE_DIR, MODEL_FILE.parent, RESULTS_DIR):
        d.mkdir(parents=True, exist_ok=True)


def rel(path):
    """Path relative to the repo root for display, or the full path if outside it."""
    try:
        return Path(path).relative_to(PROJECT_ROOT)
    except ValueError:
        return Path(path)


use_dataset(DEFAULT_DATASET)
