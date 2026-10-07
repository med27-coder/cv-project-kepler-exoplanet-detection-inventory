# Archived Colab notebooks

These are the original Google Colab notebooks, kept unchanged for reference. They mount Google Drive and install packages with `!pip`, so they will not run as-is in VS Code. Use [`../Exoplanet_Detection_V2.ipynb`](../Exoplanet_Detection_V2.ipynb) instead.

| Notebook | What it is | Why it is kept |
|---|---|---|
| `01_exploration.ipynb` | Early catalog / light-curve exploration | Original exploration work |
| `Exoplanet_Detection_V1_FM_fixed.ipynb` | V1 baseline (400 sampled, 320 usable): 59.38% accuracy, AUC 0.573 | Saved outputs document the V1 results |
| `Exoplanet_Detection_V1_5_FM_clean.ipynb` | V1.5 (1,000 sampled, 794 usable): 70.44% accuracy, AUC 0.771 | Saved outputs are the evidence for the metrics in the main README and slides; V2 code is derived from it |
| `Exoplanet_Detection_V2_colab_draft.ipynb` | The unfinished Colab start of V2. Its title still says "V3"; ignore that. 2,000 KOIs per class (3,575 usable): 74.13% accuracy, AUC 0.824. Also includes augmentation, 2D views, a diffusion (DDPM) generator and threshold analysis | Its dataset (`X_raw.npy`) is the V2 dataset, and the threshold analysis was ported to V2. Augmentation and diffusion remain here as future work |

Known issues fixed in V2:
- The example KOIs had wrong period/epoch values, and two "false positive" examples (KIC 9941662, KIC 5358624) are confirmed planets.
- Downloads were not actually parallel.
- The evaluation plots mixed `y_test` with predictions made on the NaN-filtered `y_test_eval`.
