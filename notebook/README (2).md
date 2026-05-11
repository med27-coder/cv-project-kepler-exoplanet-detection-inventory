# 🪐 Exoplanet Detection — Kepler Light Curves (CV Project)

**Course:** Computer Vision — ITAI 1378 | San Antonio College  
**Student:** Francisco Medina | GitHub: [med27-coder](https://github.com/med27-coder)  
**Repository:** [cv-project-kepler-exoplanet-detection-inventory](https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory)

---

## Problem Statement

Can a neural network learn to tell a real exoplanet from a false alarm, using only the dimming pattern of starlight?

This project applies a **1D Convolutional Neural Network (CNN)** — inspired by NASA's AstroNet architecture — to classify Kepler telescope light curves as either a confirmed exoplanet transit or a false positive. The goal was to exceed 80% accuracy and 0.85 AUC on held-out test data.

---

## Original Plan vs. Actual Implementation

The project evolved across two versions. Below is a record of the original design and the changes that had to be made.

| Component | V1 (Original Plan) | V1.5 (What Was Implemented) | Reason for Change |
|-----------|-------------------|-----------------------------|-------------------|
| **Dataset size** | 200 samples per class (400 total) | 500 per class (1,000 total) | NASA MAST servers were more stable than expected; increased data improved generalization |
| **Data persistence** | No caching; re-download every run | Google Drive checkpoints for arrays + catalog CSV | Colab session timeouts during 30-min downloads made caching essential |
| **Downloads** | Sequential (`tqdm` loop) | Parallel (`ThreadPoolExecutor`, 10 workers) with 15s timeout per request | Sequential was too slow for 1,000 KOIs; parallel cut time by ~4× |
| **EDA** | Not included | Step 2.5 added: orbital period, transit duration, and depth distributions | Instructor feedback; helps justify the CNN approach visually |
| **Example FP** | KOI-203 (KIC 5358624) | KOI-114 (KIC 6721123) | KOI-203 returned inconsistent light curves from MAST during testing |
| **Gradio frontend** | Not in scope | Step 12 added: interactive web app for live KOI prediction | Extended the project beyond classification into a usable demo tool |
| **Model save format** | `.h5` (legacy Keras) | `.keras` (native format) | TensorFlow 2.x deprecation warnings; `.keras` is the recommended format |
| **Before/After comparison** | Not included | Cell 14.5: untrained vs. trained model side-by-side | Demonstrates learning in a concrete, presentation-ready format |

---

## Approach

1. **Labels** — Downloaded the NASA KOI Cumulative Table (NASA Exoplanet Archive NStED API). Filtered to `CONFIRMED` (label = 1) and `FALSE POSITIVE` (label = 0). Balanced to 500 per class.
2. **Light Curves** — Fetched real Kepler photometry per star via `lightkurve` → NASA MAST. Flattened, phase-folded by orbital period, binned to 201 uniform bins, and z-score normalized.
3. **Architecture** — 4× (Conv1D → MaxPool1D) blocks (16→32→64→128 filters), followed by Dense(512, dropout=0.5) → Dense(256, dropout=0.3) → sigmoid output.
4. **Training** — Adam(lr=1e-4), binary cross-entropy, 50 epochs, early stopping on val_loss.
5. **Evaluation** — Confusion matrix, ROC-AUC, Precision-Recall curve, and a before/after training comparison.

---

## Data Sources

No data files are committed to this repository.

| Dataset | Source | How It's Loaded |
|---------|--------|-----------------|
| NASA KOI Cumulative Table | [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/cgi-bin/nstedAPI/nph-nstedAPI?table=cumulative&format=csv) | `pandas.read_csv(url)` in Step 2 |
| Kepler Light Curves | [NASA MAST Archive](https://mast.stsci.edu/) | `lightkurve.search_lightcurve()` per KOI in Steps 3–5 |

---

## Results (Target vs. Actual)

| Metric | Target | Achieved |
|--------|--------|----------|
| Test Accuracy | > 80% | ✅ See notebook output |
| AUC (ROC) | > 0.85 | ✅ See notebook output |
| Precision | > 80% | ✅ See notebook output |
| Recall | > 80% | ✅ See notebook output |

> Run all cells in `Exoplanet_Detection_V1_5_FM_clean.ipynb` on Google Colab (T4 GPU recommended) to reproduce exact numbers. Training takes ~5 minutes on GPU after the light curve dataset is cached.

---

## Technologies Used

Python 3 · TensorFlow/Keras · lightkurve · NumPy · Pandas · Matplotlib · Seaborn · scikit-learn · Gradio · Google Colab · NASA Exoplanet Archive API · NASA MAST

---

## How to Run

1. Open `Exoplanet_Detection_V1_5_FM_clean.ipynb` in [Google Colab](https://colab.research.google.com/).
2. Set runtime to **T4 GPU** (`Runtime > Change runtime type`).
3. Run all cells in order. Step 5 will take 15–30 min on first run; subsequent runs load from Drive.
4. (Optional) Step 12 launches a Gradio demo for interactive predictions.

---

## Project Structure

```
cv-project-kepler-exoplanet-detection-inventory/
├── README.md                              ← This file
├── Exoplanet_Detection_V1_5_FM_clean.ipynb  ← Final notebook (cleaned, with data sources)
├── Exoplanet_Detection_V1_FM.ipynb        ← Original V1 notebook (reference)
├── results/
│   ├── lightcurve_examples.png            ← Phase-folded light curve examples
│   ├── koi_physical_properties.png        ← EDA: orbital period, depth, duration
│   ├── training_history.png               ← Accuracy & loss curves
│   ├── evaluation_plots.png               ← Confusion matrix, ROC, PR curves
│   ├── predictions_examples.png           ← Sample correct & incorrect predictions
│   └── training_test_comparison.png       ← Train/val/test metrics overlay
└── Presentation/
    └── Exoplanet_CV_Portfolio_FM.pptx     ← Portfolio summary presentation
```

---

## Contact

- **Email:** francisco.medina@student.alamo.edu
- **GitHub:** [med27-coder](https://github.com/med27-coder)
- **LinkedIn:** *(add your LinkedIn URL here)*
