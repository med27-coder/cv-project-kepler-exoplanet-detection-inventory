# Results

| Folder | Contents |
|---|---|
| `v1_5/` | Figures from the V1.5 Colab run (794 light curves): 70.44% test accuracy, AUC 0.771. These are the figures used in the README and slides. |
| `v2/` | Written by `notebooks/Exoplanet_Detection_V2.ipynb` (3,576 curves): 73.32% test accuracy, AUC 0.830. Includes `metrics.json` and `threshold_analysis.png`. |
| `v3/` | Written by `scripts/pipeline/train_star_gazer.py`: `metrics.json` (all ablation variants), training histories, test predictions and figures. Git-ignored; committed only encrypted in `secure/` (split parts + manifest) (see the main README). |
| `v3_public/` | The few V3 figures shown in the main README (saliency maps, analysis charts). |
| `v4/` | (git-ignored) Star Gazer V4 / Colossus: out-of-fold predictions and the registered analyses (`scripts/pipeline/v4_giants_cv.py`, `v4b_colossus2_cv.py`); the published summary is `docs/star-gazer/V4_RESULTS.md`. |
| `scoreboard/` | Written by `scripts/pipeline/scoreboard.py`. |
| `version_progress.png`, `version_progress_dark.png` | Cross-version chart (V1 → V3) shown in the main README, written by `scripts/experiments/plot_version_progress.py`. |
| `v1_5_local/` | (created if you run the notebook with `DATASET = 'v1_5'`) |
| `colab_import/` | (git-ignored) PNGs copied in by `scripts/data/import_colab_checkpoints.py`. |
