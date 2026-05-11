# 🪐 Kepler Exoplanet Detection — AstroNet-style 1D CNN
 
**Course:** Computer Vision — ITAI 1378 | San Antonio College  
**Repository:** [cv-project-kepler-exoplanet-detection-inventory](https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory)
 
---
 
## Team Members
 
- Francisco Medina — franciscomed927@gmail.com
---
 
## Project Tier
 
**Tier 2 — Advanced Project**
 
I train a 1D Convolutional Neural Network from scratch on real NASA Kepler mission data, building a full custom data pipeline that downloads, filters, phase-folds, and normalises stellar light curves directly from the NASA Exoplanet Archive and MAST. This goes significantly beyond using a pre-trained model on a packaged dataset.
 
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
| **Size (V1)** | 400 light curves (200 confirmed planets + 200 false positives), balanced |
| **Size (V1.5)** | 1,000 light curves (500 per class), balanced |
| **Quality Filters** | 4-stage pipeline: download success check, NaN rate <10%, signal variance check, final NaN sanitisation |
| **NASA Archive Link** | https://exoplanetarchive.ipac.caltech.edu |
| **MAST Link** | https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html |
| **lightkurve docs** | https://docs.lightkurve.org |
 
> ⚠️ No data files are committed to this repository. Light curves are streamed from NASA MAST on-demand. See the [Data Sources](#data-sources) section below.
 
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
 
Results from V1 (400 samples baseline run):
 
## Success Metrics
 
| Metric | Target | Actual (V1) | Actual (V1.5) |
|---|---|---|---|
| Test Accuracy | >80% | 59.38% ❌ | 70.44% ❌ |
| Test AUC | >0.85 | 0.573 ❌ | 0.771 ❌ |
| Precision | >80% | 59.57% ❌ | 72.73% ❌ |
| Recall | >80% | 80.00% ✅ | 73.56% ❌ |
| Prediction speed | <1s per curve | 7.4 ms ✅ | 7.4 ms ✅ |
 
> V1 did not meet accuracy and AUC targets — this directly motivated the V1.5 improvements. See the section below.

> V1.5 shows meaningful improvement across all metrics (+11% accuracy, +0.198 AUC) but targets were not fully reached. Scaling to the full ~9,000 KOI catalog and hyperparameter tuning are the recommended next steps.
---
 
## Original Plan vs. Actual Implementation
 
The project evolved across two versions. Below is a record of the original design and the changes that had to be made.
 
| Component | V1 (Original Plan) | V1.5 (What Was Implemented) | Reason for Change |
|---|---|---|---|
| **Dataset size** | 200 per class (400 total) | 500 per class (1,000 total) | V1 results showed the model was underfitting; more data improves generalization |
| **Data persistence** | No caching; re-download every run | Google Drive checkpoints for arrays + catalog CSV | Colab session timeouts during 30-min downloads made caching essential |
| **Downloads** | Sequential (`tqdm` loop) | Parallel (`ThreadPoolExecutor`, 10 workers) with 15s timeout | Sequential was too slow for 1,000 KOIs; parallel cut time by ~4× |
| **EDA** | Not included | Step 2.5 added: orbital period, transit duration, and depth distributions | Visual justification for CNN approach; helps diagnose data quality |
| **Example FP** | KOI-203 (KIC 5358624) | KOI-114 (KIC 6721123) | KOI-203 returned inconsistent light curves from MAST during testing |
| **Gradio frontend** | Not in scope | Step 12 added: interactive web app for live KOI prediction | Extended the project into a usable demo tool |
| **Model save format** | `.h5` (legacy Keras) | `.keras` (native format) | TensorFlow 2.x deprecation warnings; `.keras` is the recommended format |
| **Before/After comparison** | Not included | Cell 14.5: untrained vs. trained model side-by-side | Concrete proof that learning happened; presentation-ready output |
 
---
 
## Data Sources
 
No data files are committed to this repository.
 
| # | Dataset | Source | How It's Loaded |
|---|---|---|---|
| 1 | NASA KOI Cumulative Table | [NASA Exoplanet Archive NStED API](https://exoplanetarchive.ipac.caltech.edu/cgi-bin/nstedAPI/nph-nstedAPI?table=cumulative&format=csv) | `pandas.read_csv(url)` in Step 2 |
| 2 | Kepler Light Curves | [NASA MAST Archive](https://mast.stsci.edu/) via `lightkurve` | `lk.search_lightcurve()` per KOI in Steps 3–5 |
 
---
 
## Week-by-Week Plan
 
| Week | Date | Tasks |
|---|---|---|
| Week 1 | Feb 17 | Get dataset, set up Colab environment, install dependencies |
| Week 2 | Feb 24 | Train and fine-tune 1D CNN model architecture |
| Week 3 | Mar 3 | Test, evaluate results, and complete documentation |
| Week 4 (V1 Completed) | Mar 6 | V1 finished — 59.38% accuracy, 0.573 AUC; targets not met, began planning V1.5 |
| Week 5 | Mar 10 | V1.5 planning: identified dataset size, caching, and parallelism as key improvements |
| Week 6 | Mar 17 | Implemented Google Drive checkpointing and ThreadPoolExecutor parallel downloads |
| Week 7 | Mar 24 | Expanded dataset to 500 per class (1,000 total); added EDA step (Step 2.5) |
| Week 8 | Mar 31 | Added Before/After training comparison (Cell 14.5); fixed KOI-203 → KOI-114 FP example |
| Week 9 | Apr 7 | Built Gradio web frontend (Step 12); switched model save format to `.keras` |
| Week 10 | Apr 14 | Full V1.5 training run; evaluated results and compared against V1 baseline |
| Week 11 | Apr 21 | Documentation pass: cleaned notebook, added data source comments and markdown cell |
| Week 12 | Apr 28 | Portfolio deliverables: README updated, PPTX presentation created |
| Week 13 (V1.5 Completed) | May 8 | V1.5 finished — 70.44% accuracy, 0.771 AUC; +11% and +0.198 improvement over V1 🎉 |
 
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
 
1. Open `Exoplanet_Detection_V1_5_FM_clean.ipynb` in [Google Colab](https://colab.research.google.com/)
2. Set runtime to **T4 GPU** (`Runtime > Change runtime type`)
3. Run all cells in order — Step 5 takes 15–30 min on first run; subsequent runs load from Drive cache
4. After training, the **Slide 7 Metrics cell** (Cell 14) prints exact performance numbers
5. (Optional) Step 12 launches a Gradio demo for interactive predictions
---
 
## Repository Structure
 
```
cv-project-kepler-exoplanet-detection-inventory/
├── README.md                                    ← You are here
├── Exoplanet_Detection_V1_5_FM_clean.ipynb      ← Final notebook (cleaned, data sources documented)
├── Exoplanet_Detection_V1_FM.ipynb              ← Original V1 notebook (reference)
├── results/
│   ├── lightcurve_examples.png
│   ├── koi_physical_properties.png
│   ├── training_history.png
│   ├── evaluation_plots.png
│   ├── predictions_examples.png
│   └── training_test_comparison.png
└── Presentation/
    └── Exoplanet_CV_Portfolio_FM.pptx
```
 
---
 
## AI Usage Log
 
| Date | Tool | Task | Notes |
|---|---|---|---|
| Feb 24, 2026 | Claude (Anthropic) | Notebook setup, debugging | Used for code generation and error fixing |
| Mar 6, 2026 | Gamma AI | Slide design & visualization | Used to design and structure project presentation slides from written content |
| May 2026 | Claude (Anthropic) | README, cleaned notebook, portfolio PPTX | Used to generate portfolio documentation deliverables |
 
---
 
## Contact
 
- **Email:** franciscomed927@gmail.com
- **GitHub:** [med27-coder](https://github.com/med27-coder)
- **LinkedIn:** *[Francisco_Medina](https://www.linkedin.com/in/francisco-medina-9b015b380/)*
 
