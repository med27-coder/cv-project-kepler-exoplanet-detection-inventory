# 🪐 Kepler Exoplanet Detection — AstroNet-style 1D CNN

## Team Members
- Francisco Medina - franciscomed927@gmailcom


---

## Project Tier

**Tier 2 — Advanced Project**

We train a 1D Convolutional Neural Network from scratch on real NASA Kepler mission data, building a full custom data pipeline that downloads, filters, phase-folds, and normalises stellar light curves directly from the NASA Exoplanet Archive and MAST. This goes significantly beyond using a pre-trained model on a packaged dataset.

---

## Problem Statement

NASA's Kepler Space Telescope recorded brightness measurements for over 150,000 stars, generating thousands of potential exoplanet transit signals (Kepler Objects of Interest, or KOIs). Astronomers must distinguish genuine exoplanet transits from false positives caused by binary stars, instrument noise, or other astrophysical phenomena. Manual classification is time-consuming, subjective, and doesn't scale to the volume of data produced by modern space missions.

---

## Solution Overview

I built an automated exoplanet detection pipeline using a 1D Convolutional Neural Network (inspired by Google's AstroNet architecture) trained on phase-folded Kepler light curves. The model takes a 201-point normalised flux array as input and outputs a probability score (0–1) indicating whether the signal is a confirmed planet or a false positive. The full pipeline covers data acquisition, quality filtering, model training, and evaluation.

---

## Technical Approach

| Field | Details |
|---|---|
| **CV Technique** | Binary time-series classification |
| **Model** | 1D CNN — 4 convolutional blocks (16→32→64→128 filters) + Dense head |
| **Framework** | TensorFlow 2.x / Keras + scikit-learn for evaluation |
| **Why this approach** | 1D CNNs naturally capture local patterns in sequential flux data and outperform traditional 2D image approaches for light curve classification, matching the architecture used in the original AstroNet paper |

---

## Dataset

| Field | Details |
|---|---|
| **Source** | NASA Exoplanet Archive + MAST (Mikulski Archive for Space Telescopes) |
| **Labels** | Pre-labeled by NASA: `CONFIRMED` (class 1) vs `FALSE POSITIVE` (class 0) |
| **Size** | Up to 400 light curves (200 confirmed planets + 200 false positives), balanced |
| **Quality Filters** | 4-stage pipeline: download success check, NaN rate <10%, signal variance check, final NaN sanitisation |
| **NASA Archive Link** | https://exoplanetarchive.ipac.caltech.edu |
| **MAST Link** | https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html |
| **lightkurve docs** | https://docs.lightkurve.org |

See [`data/README.md`](data/README.md) for full dataset details.

---

## Model Architecture

```
Input (201, 1)
    ↓
Conv1D(16, kernel=5) → MaxPooling1D(2)
    ↓
Conv1D(32, kernel=5) → MaxPooling1D(2)
    ↓
Conv1D(64, kernel=5) → MaxPooling1D(2)
    ↓
Conv1D(128, kernel=5) → MaxPooling1D(2)
    ↓
Flatten → Dense(512) → Dropout(0.5)
    ↓
Dense(256) → Dropout(0.3)
    ↓
Dense(1, sigmoid) → Planet probability (0–1)
```

**Training config:**
- Optimizer: Adam (lr=1e-4)
- Loss: Binary Crossentropy
- Max epochs: 60 (EarlyStopping, patience=8, monitor=val_auc)
- Batch size: 32
- Split: 68% train / 12% val / 20% test (stratified)

---

## Success Metrics

| Metric | Target | Actual |
|---|---|---|
| Test Accuracy | >80% | *59.38%* |
| Test AUC | >0.85 | *0.573* |
| Precision | >80% | *59.57%* |
| Recall | >80% | *80.00%* |
| Prediction speed | <1s per curve | *7.4 ms* |

---

## Week-by-Week Plan

| Week | Date | Tasks |
|---|---|---|
| Week 1 | Feb 17 | Get dataset, set up Colab environment, install dependencies |
| Week 2 | Feb 24 | Train and fine-tune 1D CNN model architecture |
| Week 3 | Mar 3 | Test, evaluate results, and complete documentation |
| Week 4 (Completed) | Mar 6 | Project finished! 🎉 |

---

## Resources

| Resource | Details |
|---|---|
| **Compute** | Google Colab (T4 GPU recommended, free tier) |
| **Cost** | $0 — fully free (NASA data is public, Colab GPU is free) |
| **APIs** | None — all data pulled directly from NASA/MAST public APIs |

---

## Risks & Mitigation

| Risk | Probability | Mitigation |
|---|---|---|
| Light curves with too many NaN values | High | 4-stage quality filter pipeline; increase sample size from NASA catalog |
| Model fails to hit accuracy targets | Medium | Try deeper architecture, add data augmentation, tune hyperparameters |
| NASA MAST archive unavailable / rate limiting | Medium | Use cached dataset from previous runs, reduce sample size |
| fsspec / dependency version conflicts | Low | Pin fsspec==2025.3.0 before installing lightkurve (already in notebook) |

---

## How to Run

1. Open `notebooks/exoplanet_detection_colab.ipynb` in [Google Colab](https://colab.research.google.com)
2. Set runtime: `Runtime > Change runtime type > T4 GPU`
3. Run all cells top to bottom (`Runtime > Run all`)
4. Step 5 (dataset download) takes ~10–15 minutes
5. After training, run the **Slide 7 Metrics cell** to get your exact performance numbers

---

## Repository Structure

```
kepler-exoplanet-detection/
├── README.md                          ← You are here
├── requirements.txt                   ← Python dependencies
├── notebooks/
│   └── exoplanet_detection_colab.ipynb  ← Main Colab notebook
├── data/
│   └── README.md                      ← Dataset info & links
└── docs/
    └── proposal.pdf                   ← Project proposal slides
```

---

## AI Usage Log

| Date | Tool | Task | Notes |
|---|---|---|---|
| *Feb 24,2026* | Claude (Anthropic) | Notebook setup, debugging | Used for code generation and error fixing |
| March 6, 2026 | Gamma AI | Slide design & visualization | Used to design and structure project presentation slides from written content |
