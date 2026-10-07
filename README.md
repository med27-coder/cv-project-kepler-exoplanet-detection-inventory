# 🪐 Kepler Exoplanet Detection — AstroNet-style 1D CNN

**Course:** Computer Vision — ITAI 1378 | San Antonio College
**Repository:** [cv-project-kepler-exoplanet-detection-inventory](https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory)

> **V2 (October 2026):** the project now runs locally in **VS Code** (no Google Colab or Drive). See [How to Run](#how-to-run-v2--vs-code). Use is subject to the [Terms of Use](TERMS_OF_USE.md).

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
| **Size (V1)** | 400 light curves sampled (200 per class) → 320 usable after filtering |
| **Size (V1.5)** | 1,000 light curves sampled (500 per class) → 794 usable after filtering |
| **Size (V2)** | 4,000 light curves sampled (2,000 per class) → 3,576 unique usable curves (1,771 planets, 1,805 false positives) |
| **Quality Filters** | 4-stage pipeline: download success check, NaN rate <10%, signal variance check, final NaN sanitisation |
| **NASA Archive Link** | https://exoplanetarchive.ipac.caltech.edu |
| **MAST Link** | https://mast.stsci.edu/portal/Mashup/Clients/Mast/Portal.html |
| **lightkurve docs** | https://docs.lightkurve.org |

> ⚠️ No data files are committed to this repository. Light curves are streamed from NASA MAST on demand and cached locally under `data/`. See [data/README.md](data/README.md).

---

## Model Architecture

```
Input (201, 1)
    ↓
4 × [Conv1D(k=5) → BatchNorm → ReLU → MaxPooling1D(2)]   filters 16 → 32 → 64 → 128
    ↓
Flatten → Dense(512) → Dropout(0.5)
    ↓
Dense(256) → Dropout(0.3)
    ↓
Dense(1, sigmoid) → Planet probability (0–1)
```

**Training config:**
- Optimizer: Adam (lr=1e-4), ReduceLROnPlateau (factor 0.5, patience 4)
- Loss: Binary Crossentropy
- Max epochs: 60 (EarlyStopping, patience=8, monitor=val_auc)
- Batch size: 32
- Split: 68% train / 12% val / 20% test (stratified, seed 42)

---

## Success Metrics

| Metric | Target | Actual (V1) | Actual (V1.5) | Actual (V2) |
|---|---|---|---|---|
| Test Accuracy | >80% | 59.38% ❌ | 70.44% ❌ | 73.32% ❌ |
| Test AUC | >0.85 | 0.573 ❌ | 0.771 ❌ | 0.830 ❌ |
| Precision | >80% | 59.57% ❌ | 72.73% ❌ | 73.84% ❌ |
| Recall | >80% | 80.00% ✅ | 73.56% ❌ | 71.55% ❌ |
| Prediction speed | <1s per curve | 7.4 ms ✅ | 7.4 ms ✅ | 9.0 ms ✅ (CPU) |
| Test set size | — | 64 | 159 | 716 |

> V1 did not meet accuracy and AUC targets — this directly motivated the V1.5 improvements.

> V1.5 shows meaningful improvement across all metrics (+11% accuracy, +0.198 AUC) but targets were not fully reached. Scaling to the full ~9,000 KOI catalog and hyperparameter tuning are the recommended next steps.

> V2 keeps the V1.5 pipeline and model unchanged but trains on 4.5× more data. Every metric except recall improves (+2.9 points accuracy, +0.059 AUC), and the test set is 4.5× larger, so the estimate is more reliable. At the best-F1 decision threshold (0.34), recall rises to 84.5% at 70.4% precision. The Colab draft of V2 reported 74.13% / 0.824 on the same data before duplicates were removed. The figures and `metrics.json` are in `results/v2/`.

---

## Original Plan vs. Actual Implementation

The project evolved across three versions. V2 began as a Colab notebook titled "V3" that was never finished. It is archived as `notebooks/archive_colab/Exoplanet_Detection_V2_colab_draft.ipynb`, and its dataset is the V2 dataset.

| Component | V1 (Original Plan) | V1.5 (What Was Implemented) | Reason for Change |
|---|---|---|---|
| **Dataset size** | 200 per class (400 total) | 500 per class (1,000 total) | V1 results showed the model was underfitting; more data improves generalization |
| **Data persistence** | No caching; re-download every run | Google Drive checkpoints for arrays + catalog CSV | Colab session timeouts during 30-min downloads made caching essential |
| **Downloads** | Sequential (`tqdm` loop) | `ThreadPoolExecutor` with 15s timeout | Sequential was too slow for 1,000 KOIs |
| **EDA** | Not included | Step 2.5 added: orbital period, transit duration, and depth distributions | Visual justification for CNN approach; helps diagnose data quality |
| **Example FP** | KOI-203 (KIC 5358624) | KOI-114 (KIC 6721123) | KOI-203 returned inconsistent light curves from MAST during testing |
| **Gradio frontend** | Not in scope | Step 12 added: interactive web app for live KOI prediction | Extended the project into a usable demo tool |
| **Model save format** | `.h5` (legacy Keras) | `.keras` (native format) | TensorFlow 2.x deprecation warnings; `.keras` is the recommended format |
| **Before/After comparison** | Not included | Cell 14.5: untrained vs. trained model side-by-side | Concrete proof that learning happened; presentation-ready output |

### V2 — VS Code / local version

| Component | V1.5 | V2 | Reason |
|---|---|---|---|
| **Environment** | Google Colab + Drive mount, `!pip` in cells | Local `.venv`, `requirements.txt`, VS Code settings/launch configs | Run anywhere without Colab session limits |
| **Code layout** | Everything in one notebook | Shared package `src/kepler_cnn/` (config, data, model, plots, terms) used by the notebook and the app | One source of truth; the app no longer depends on notebook state |
| **Downloads** | Each job was submitted and then awaited before the next one, so they ran one at a time | Truly parallel (`as_completed`), one cached `.npy` per KOI, resumable, failed KOIs remembered | Faster, and an interrupted run resumes where it stopped |
| **Dataset** | 794 curves (500 sampled per class) | 3,576 unique curves (2,000 sampled per class), from the Colab draft. `DATASET = 'v1_5'` still reproduces V1.5 | More data; the Colab arrays held 624 repeated rows, which are removed to avoid train/test leakage |
| **Reusing old runs** | Drive folder only | `scripts/import_colab_checkpoints.py` moves Colab files into `data/processed/<dataset>/` and `models/<dataset>/` | Avoid re-downloading ~4,000 light curves |
| **Threshold analysis** | — | Precision / recall / F1 vs. decision threshold (ported from the Colab draft) | 0.5 is arbitrary; shows the trade-off |
| **Example KOIs** | Hard-coded IDs/period/epoch | Looked up by KOI name in the catalog | The V1.5 values did not match the catalog: "Kepler-90g" used P=14.45 d (the catalog lists 210.6 d), and the "KOI-189" and "KOI-203" false-positive examples are confirmed planets (Kepler-13 b, Kepler-428 b). This explains the "inconsistent" KOI-203 results |
| **Evaluation plots** | Plotted `y_test` against predictions from the NaN-filtered `y_test_eval` | One consistent test set | Prevents misaligned confusion matrix / ROC |
| **Catalog API** | Legacy NStED API | NASA TAP API (NStED kept as fallback) | NStED is the deprecated interface |
| **Gradio app** | Notebook cell, `share=True` by default | `app.py`, local-only by default, `--share` opt-in | Safer default; doesn't block the notebook |
| **Terms of Use** | — | [TERMS_OF_USE.md](TERMS_OF_USE.md), enforced in the notebook and app | Clarifies educational scope, data-provider etiquette, no-warranty |

---

## Data Sources

No data files are committed to this repository.

| # | Dataset | Source | How It's Loaded |
|---|---|---|---|
| 1 | NASA KOI Cumulative Table | [NASA Exoplanet Archive TAP API](https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+kepid,kepoi_name,koi_disposition,koi_period,koi_time0bk+from+cumulative&format=csv) | `kepler_cnn.data.load_catalog()` |
| 2 | Kepler Light Curves | [NASA MAST Archive](https://mast.stsci.edu/) via `lightkurve` | `kepler_cnn.data.get_dataset()` |

---

## How to Run (V2 — VS Code)

**Requirements:** VS Code with the *Python* and *Jupyter* extensions (recommended automatically when you open the folder), and **64-bit x64 Python 3.10–3.12**.

> On Windows-on-ARM laptops, use the x64 Python build. TensorFlow has no native ARM64 Windows wheels, but the x64 build runs fine under emulation. Training on CPU takes a few minutes; no GPU is needed.

1. **Create the environment** (VS Code terminal, from the repo root):
   ```powershell
   py -3.12 -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```
2. **(Optional) Reuse your Colab files.** Download the `exoplanet_checkpoints` folder from Google Drive, then:
   ```powershell
   .venv\Scripts\python scripts\import_colab_checkpoints.py "C:\path\to\exoplanet_checkpoints"
   ```
   - `X_raw.npy` + `y_raw.npy` become the **v2** dataset, with duplicates removed.
   - `X_lightcurves.npy`, `y_labels.npy` and `exoplanet_cnn_model.keras` become the **v1_5** dataset and model.
   - `nasa_koi_catalog.csv` goes to `data/raw/`.

   Nothing needs to be downloaded again.
3. **Open** `notebooks/Exoplanet_Detection_V2.ipynb`, select the **`.venv`** kernel, read the [Terms of Use](TERMS_OF_USE.md), set `ACCEPT_TERMS = True` in Cell 0.2, and choose **Run All**.
   - Without cached data, Step 4 downloads about 1,000 light curves from MAST (10–30 min). If interrupted, re-running resumes where it stopped.
   - `DATASET = 'v2'` (default) trains the model in about a minute on CPU the first time, then loads it from `models/v2/`. Set `RETRAIN = True` to train again.
   - `DATASET = 'v1_5'` loads the V1.5 Colab model and reproduces its reported metrics.
4. **(Optional) Web demo:**
   ```powershell
   .venv\Scripts\python app.py            # http://127.0.0.1:7860
   ```
   Or use **Run and Debug ▸ "Gradio app (local)"**. Add `--share` for a temporary public link (see Terms §6).

Figures are written to `results/v2/`. The trained model is saved to `models/`.

---

## Repository Structure

```
cv-project-kepler-exoplanet-detection-inventory/
├── README.md                     ← You are here
├── TERMS_OF_USE.md               ← Terms of Use (accepted in notebook / app)
├── requirements.txt              ← Local (VS Code) dependencies
├── pyproject.toml                ← Lets `pip install -e .` install src/kepler_cnn
├── app.py                        ← Gradio web demo (local by default)
├── .vscode/                      ← Interpreter, notebook root, launch configs, extensions
├── src/kepler_cnn/
│   ├── config.py                 ← Paths & constants (single source of truth)
│   ├── data.py                   ← Catalog, download/fold, quality filters, dataset cache
│   ├── model.py                  ← 1D CNN, training, evaluation, prediction
│   ├── plots.py                  ← All figures (saved to results/v2/)
│   └── terms.py                  ← Terms of Use acceptance gate
├── scripts/
│   └── import_colab_checkpoints.py  ← Moves your old Colab/Drive files into place
├── notebooks/
│   ├── Exoplanet_Detection_V2.ipynb  ← ✅ Current notebook (VS Code)
│   └── archive_colab/                ← Original Colab notebooks (V1, V1.5, V2 draft, exploration), unchanged
├── data/                         ← Local data cache (git-ignored); see data/README.md
├── models/                       ← models/<dataset>/: .keras model + training history (git-ignored)
├── results/
│   ├── v1_5/                     ← Figures from the V1.5 Colab run (reported metrics)
│   └── v2/                       ← Figures written by the V2 notebook
└── docs/
    ├── Exoplanet_CV_Portfolio_FM.pptx
    └── MDMedinaFranciscoITAI1378pdf.pdf
```

---

## Week-by-Week Plan

| Week | Date | Tasks |
|---|---|---|
| Week 1 | Feb 17 | Get dataset, set up Colab environment, install dependencies |
| Week 2 | Feb 24 | Train and fine-tune 1D CNN model architecture |
| Week 3 | Mar 3 | Test, evaluate results, and complete documentation |
| Week 4 (V1 Completed) | Mar 6 | V1 finished — 59.38% accuracy, 0.573 AUC; targets not met, began planning V1.5 |
| Week 5 | Mar 10 | V1.5 planning: identified dataset size, caching, and parallelism as key improvements |
| Week 6 | Mar 17 | Implemented Google Drive checkpointing and ThreadPoolExecutor downloads |
| Week 7 | Mar 24 | Expanded dataset to 500 per class (1,000 total); added EDA step (Step 2.5) |
| Week 8 | Mar 31 | Added Before/After training comparison (Cell 14.5); fixed KOI-203 → KOI-114 FP example |
| Week 9 | Apr 7 | Built Gradio web frontend (Step 12); switched model save format to `.keras` |
| Week 10 | Apr 14 | Full V1.5 training run; evaluated results and compared against V1 baseline |
| Week 11 | Apr 21 | Documentation pass: cleaned notebook, added data source comments and markdown cell |
| Week 12 | Apr 28 | Portfolio deliverables: README updated, PPTX presentation created |
| Week 13 (V1.5 Completed) | May 8 | V1.5 finished — 70.44% accuracy, 0.771 AUC; +11% and +0.198 improvement over V1 🎉 |
| V2 (Colab draft) | Mar 21–22 | Started V2 on Colab (titled "V3"): 2,000 KOIs per class, augmentation and diffusion experiments; not finished |
| V2 (Completed) | Oct 6 | Migrated to VS Code with the 3,576-curve dataset: local package, resumable parallel downloads, Colab-file import, duplicate removal, corrected example KOIs, Terms of Use. 73.32% accuracy, 0.830 AUC |

---

## Resources

| Resource | Details |
|---|---|
| **Compute** | Local machine (CPU is sufficient). V1/V1.5 used Google Colab (T4 GPU) |
| **Cost** | $0 — NASA data is public |
| **APIs** | None requiring keys — NASA Exoplanet Archive and MAST public APIs |

---

## Risks & Mitigation

| Risk | Probability | Mitigation |
|---|---|---|
| Light curves with too many NaN values | High | 4-stage quality filter pipeline; increase sample size from NASA catalog |
| Model fails to hit accuracy targets | High (still below target in V2) | Use all Kepler quarters per star (currently the first only), tune the decision threshold on the validation set, try the augmentation from the V2 Colab draft, tune the architecture |
| NASA MAST archive unavailable / rate limiting | Medium | Per-KOI local cache with resume; modest worker count; import previous Colab arrays |
| TensorFlow install on Windows-on-ARM | Medium | Use the x64 Python build (runs under emulation) |

---

## Terms of Use

Use of this project is governed by [TERMS_OF_USE.md](TERMS_OF_USE.md): educational / non-commercial use, model output is **not** a scientific classification, no warranty, and responsible use of NASA/MAST services. The notebook and web app ask for acceptance before downloading data or making predictions.

---

## AI Usage Log

| Date | Tool | Task | Notes |
|---|---|---|---|
| Feb 24, 2026 | Claude (Anthropic) | Notebook setup, debugging | Used for code generation and error fixing |
| Mar 6, 2026 | Gamma AI | Slide design & visualization | Used to design and structure project presentation slides from written content |
| May 2026 | Claude (Anthropic) | README, cleaned notebook, portfolio PPTX | Used to generate portfolio documentation deliverables |
| Oct 6, 2026 | Claude Code (Anthropic) | V2 migration to VS Code | Repo reorganisation, `src/kepler_cnn` package, V2 notebook, Colab import script, Terms of Use |

---

## Contact

- **Email:** franciscomed927@gmail.com
- **GitHub:** [med27-coder](https://github.com/med27-coder)
- **LinkedIn:** [Francisco Medina](https://www.linkedin.com/in/francisco-medina-9b015b380/)
