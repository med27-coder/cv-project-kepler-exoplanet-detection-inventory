# kepler_cnn: the project's Python package

Installed in editable mode (`pip install --no-deps -e .`), so scripts, notebooks, the app and tests all
`import kepler_cnn`. Shared logic lives here, never in scripts.

| Module | What it does |
|---|---|
| `config.py` | Project paths and constants, resolved from the repository root |
| `terms.py` | The Terms of Use acceptance gate (before downloads and training) |
| `runtime.py` | Keeps long jobs polite: low CPU priority, TensorFlow thread limits |
| **V3 "Star Gazer"** | |
| `views.py` | Builds the light-curve views from *all* Kepler quarters: download, stitch, detrend, fold into global / local / odd / even / secondary-eclipse / centroid views |
| `star_gazer.py` | Catalog, dataset, splits by star, feature scaling, the multi-branch model, training, evaluation, saving and loading |
| `training.py` | Shared by the training, cross-validation and ablation scripts: which inputs each variant sees, checkpointed training that resumes, scoring with a validation-chosen threshold |
| `saliency.py` | Occlusion saliency: which part of a light curve (or which catalog number) drove a prediction |
| `plots.py` | Figures for results and notebooks |
| **V1–V2 (kept for the notebooks)** | |
| `data.py` | V2 catalog loading, single-quarter download and folding |
| `model.py` | V2 AstroNet-style 1D CNN |

Models load with Keras `safe_mode=True` (no embedded code) and arrays with `allow_pickle=False`.
