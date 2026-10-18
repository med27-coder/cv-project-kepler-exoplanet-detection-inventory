# Star Gazer V4b, Colossus 2: pre-registration

Written and committed on 17 October 2026, **before any Colossus 2 network was trained**. It follows the failed
first attempt ([V4_RESULTS.md](V4_RESULTS.md)), whose lesson was that a giant specialist must read the light curve.
The question, giant set, folds, hand-off, endpoints and decision rules are those of
[V4_PREREGISTRATION.md](V4_PREREGISTRATION.md); only the model changes.

## 1. Honest caveat, stated up front

This is a **second test on the same cross-validation folds** as Colossus 1, and its design was chosen after seeing
that attempt fail (the general lesson "read the views", not any number of these folds). A pass here is weaker
evidence than a first test would be. The **prospective test** (section 5) is the decisive one.

## 2. The model (fixed, no tuning)

Inside each of V3's five folds, with V3's own inner train/validation split (`split_train_val`, seed SEED + fold):

1. **Stage A**: V3's exact hybrid network (same architecture, optimiser, epochs, early stopping, class weights,
   time-reversal augmentation, seed SEED + fold), trained on **all** of the fold's training KOIs, with the catalog
   input widened from V3's 22 features to 31: V3's 22 (V3's preprocessing) plus the 9 registered physics features
   of V4 (`giants.PHYSICS`), each median-imputed, standardised on the fold's training rows and clipped to ±10, with
   `ruwe` and `n_gaia_within_2as` log-scaled first.
2. **Stage B (Colossus 2)**: Stage A's network fine-tuned on the fold's **giant** training KOIs (≥ 6 Earth radii)
   only: Adam at 1e-5 (a tenth of V3's rate), at most 30 epochs, early stopping on the AUC of the fold's giant
   validation KOIs (V3's patience of 8), class weights from the giant training KOIs.

Colossus 2's score for a giant test KOI is Stage B's output. **Stage A** is reported as an ablation ("physics inside
V3, no specialist"), never used to choose.

## 3. Hand-off and endpoints

Exactly as registered for V4: the radius blend (V3 below 6 Earth radii, Colossus above 10, linear between); the
primary endpoint is recall of confirmed giants at V3's false-positive rate on the giant set, compared with V3's
out-of-fold recall (81.0%, `results/v3/cv_oof.npz`), success if the lower end of the paired star-bootstrap 95%
interval of the difference is above 0; the same secondary endpoints, including non-inferiority of the combined
system (within 0.2 points of V3's 97.02%).

## 4. Reporting

Every number, pass or fail, in `docs/V4B_RESULTS.md`; an independent audit before anything reaches the README.

## 5. Prospective test

If the primary endpoint passes, V3 and the combined system score every CANDIDATE KOI, the predictions are saved
(`results/v4/prospective_<date>.csv`, SHA-256 committed) and judged later against NASA's rulings
(`web/data/resolutions.js`). Adoption waits for that, given section 1.

## 6. Changes after registration

(none yet)
