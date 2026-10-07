# 📦 Dataset Information

No data is committed to this repository. Everything is downloaded from public NASA services the first time you run the notebooks or scripts, then cached locally in this folder. The cache is git-ignored.

V2 (single quarter, 1D CNN) and V3 Star Gazer (all quarters, multi-view CNN) use separate caches; see [V3 Star Gazer data](#v3-star-gazer-data) at the end.

## Folder layout

```
data/
├── raw/
│   ├── nasa_koi_catalog.csv      ← KOI cumulative table (labels, period, epoch), V2
│   └── koi_cumulative_full.csv   ← the same table with all 150+ columns, V3
├── interim/
│   ├── views/                    ← V3: one .npz of views per KOI (see below)
│   └── flux/
│       ├── K00752.01.npy         ← one phase-folded, normalised curve per KOI (201 values)
│       └── _failed.txt           ← KOIs that failed to download (skipped on re-runs)
└── processed/
    ├── v2/                       ← default: 3,576 curves (from the Colab draft's X_raw.npy, deduplicated)
    │   ├── X_lightcurves.npy     ← (N, 201) training matrix after quality filters
    │   ├── y_labels.npy          ← (N,) labels: 1 = CONFIRMED, 0 = FALSE POSITIVE
    │   └── dataset_index.csv     ← which KOI each row of X is (local builds only)
    └── v1_5/                     ← 794 curves from the V1.5 run
```

Trained models live in `models/<dataset>/`: `exoplanet_cnn_model.keras` and `training_history.json`. Choose the dataset with `DATASET` in the notebook (Cell 0.3) or `--dataset` in `app.py`.

## Bringing your Colab files over

The Colab notebooks saved their checkpoints to Google Drive in `MyDrive/exoplanet_checkpoints/`. Download that folder, then run:

```powershell
.venv\Scripts\python scripts\import_colab_checkpoints.py "C:\path\to\exoplanet_checkpoints" --dry-run   # preview
.venv\Scripts\python scripts\import_colab_checkpoints.py "C:\path\to\exoplanet_checkpoints"
```

| Colab file | Goes to |
|---|---|
| `X_raw.npy`, `y_raw.npy` (Colab V2 draft) | `data/processed/v2/`, with duplicate rows removed (4,200 → 3,576) |
| `X_lightcurves.npy`, `y_labels.npy` (V1.5) | `data/processed/v1_5/` |
| `exoplanet_cnn_model.keras` (V1.5) | `models/v1_5/` |
| `nasa_koi_catalog.csv` | `data/raw/` |
| `*.png` | `results/colab_import/` |

The script never overwrites existing files unless you pass `--overwrite`. Arrays from Colab have no `dataset_index.csv`. That's fine: the notebook trains on them directly, and the deterministic split (seed 42) gives the same test set the Colab model was evaluated on.

## Data sources

### 1. NASA Exoplanet Archive: KOI cumulative catalog

| Field | Details |
|---|---|
| **URL** | https://exoplanetarchive.ipac.caltech.edu |
| **API (V2)** | TAP: `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+...+from+cumulative&format=csv` (legacy NStED API used as fallback) |
| **Size** | ~9,560 KOI entries |
| **Used** | CONFIRMED (class 1) and FALSE POSITIVE (class 0) only |
| **Sampled** | v2: 2,000 per class. v1_5: 500 per class. Both use `random_state=42` |
| **Key columns** | `kepid`, `kepoi_name`, `koi_disposition`, `koi_period`, `koi_time0bk`, `koi_duration`, `koi_depth` |

### 2. MAST: Kepler light curves

| Field | Details |
|---|---|
| **URL** | https://mast.stsci.edu |
| **Access** | `lightkurve.search_lightcurve(..., mission='Kepler', cadence='long')`. The first available quarter is used |
| **Format** | FITS → numpy |
| **Cadence** | Long cadence (~30 min) |
| **Raw FITS cache** | lightkurve keeps its own cache in `~/.cache/lightkurve` (outside this repo) |

Credit both services when you use this data (see [TERMS_OF_USE.md](../TERMS_OF_USE.md) §3).

## Processing pipeline

```
Raw FITS light curve (MAST, first available quarter)
        ↓
Flatten stellar variability (Savitzky-Golay, window=101)
        ↓
Phase-fold at the catalog period / epoch
        ↓
Bin to 201 points  →  normalise: (flux − median) / std
        ↓
Quality filters:
  ✓ download succeeded
  ✓ NaN fraction ≤ 10%
  ✓ std ≥ 1e-4 (not a flat/dead signal)
  ✓ remaining NaNs → 0
        ↓
(201,) array, ready for the model
```

In the V1.5 run, 794 of 1,000 sampled KOIs survived these steps. The V2 dataset has 3,576 unique curves after duplicate rows in the Colab arrays were removed; duplicates could put the same curve in both train and test.

**Known limitation:** only one Kepler quarter (~90 days, sometimes ~33 days for Q1) is downloaded per star. Planets with long orbital periods are therefore poorly covered. For example, Kepler-90 g (P = 210 d) cannot be folded at all. Stitching all quarters (`search.download_all().stitch()`) is the most promising next step for accuracy, but it changes the dataset, so the V1.5 arrays would no longer be comparable. V3 Star Gazer does exactly this.

## V3 Star Gazer data

Built by `scripts/build_full_dataset.py` (resumable; a few hours for all ~6,600 stars):

1. **Catalog:** the full KOI cumulative table (`select * from cumulative`), saved as `data/raw/koi_cumulative_full.csv`. Every CONFIRMED and FALSE POSITIVE KOI is used (7,587), not a sample.
2. **Light curves:** every long-cadence quarter of each star (up to 18, about 4 years) is downloaded straight from MAST (`mast.stsci.edu/api/v0.1/Download/file?uri=mast:KEPLER/...`), using AstroNet's fixed per-quarter file names. Quarters a star was not observed in return 404 and are skipped; network errors are retried with backoff.
3. **Processing per star:** flagged cadences removed (lightkurve's default quality mask), each quarter normalised, every known transit on the star masked, then a Savitzky-Golay trend (window ≥ 1 day or 3× the longest transit) divided out. Upward outliers above 3σ are dropped.
4. **Views per KOI** (`src/kepler_cnn/views.py`), saved as `data/interim/views/<KOI>.npz`:

| View | Bins | What it shows |
|---|---|---|
| `global_view` | 2001 | whole orbit, phase-folded |
| `local_view` | 201 | transit zoom, ±2 durations (overlapping bins 0.16 durations wide) |
| `odd_view`, `even_view` | 201 | odd- and even-numbered transits separately (an eclipsing binary at twice the period alternates in depth) |
| `secondary_view` | 201 | zoom on the deepest dip away from the transit (secondary eclipse) |
| `centroid_view` | 201 | centroid shift ÷ transit depth ≈ distance in pixels from the target to the source of the dip (background binaries) |

The raw FITS files are deleted after each star, so the whole cache is about 200 MB.

KOIs that could not be folded (no usable data at their period) are listed in `views/_skipped.txt`, and stars that could not be downloaded in `views/_failed.txt`; `--retry-failed` retries both. Each view file records its recipe version (`views.VIEW_VERSION`), and files from an older recipe are rebuilt automatically.
