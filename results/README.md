# Results

| Folder | Contents |
|---|---|
| `v1_5/` | Figures from the V1.5 Colab run (794 light curves): 70.44% test accuracy, AUC 0.771. These are the figures used in the README and slides. |
| `v2/` | Written by `notebooks/Exoplanet_Detection_V2.ipynb` (3,576 curves): 73.32% test accuracy, AUC 0.830. Includes `metrics.json` and `threshold_analysis.png`. |
| `v3/` | Written by `scripts/pipeline/train_star_gazer.py`: `metrics.json` (all ablation variants), training histories, test predictions and figures. Git-ignored; committed only encrypted in `secure/` (split parts + manifest) (see the main README). |
| `version_progress.png`, `version_progress_dark.png` | Cross-version chart (V1 → V3) shown in the main README, written by `scripts/experiments/plot_version_progress.py`. |
| `v1_5_local/` | (created if you run the notebook with `DATASET = 'v1_5'`) |
| `colab_import/` | (git-ignored) PNGs copied in by `scripts/data/import_colab_checkpoints.py`. |
