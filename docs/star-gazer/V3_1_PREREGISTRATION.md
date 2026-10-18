# Star Gazer V3.1: pre-registration

Written and committed on 18 October 2026, **before any V3.1 network is trained on the folds below**. It follows the
lead in [V4B_RESULTS.md](V4B_RESULTS.md): Stage A of Colossus 2 (V3's network with the physics features) found more
giants than V3 at the same false-alarm rate and edged it on everything else. Those comparisons were made after the
fact on folds that had already been used twice, so this registration tests the idea on new evidence.

## 1. Honest caveat, stated up front

The idea came from looking at results on V3's folds (seed 42). Testing it on the same folds again would be circular.
So V3.1 is judged on **new folds** (section 3) and, decisively, on the **prospective test** (section 6). V3's design
stays frozen; nothing here is chosen or tuned on V3's held-out test split.

## 2. The model (fixed, no tuning)

V3.1 is Colossus 2's Stage A, unchanged, as a model for **every** KOI (no specialist, no hand-off):

- V3's exact hybrid network: same architecture, optimiser, epochs, early stopping, class weights, time-reversal
  augmentation, inner train/validation split (`split_train_val`, seed = fold seed + fold).
- The catalog input widened from V3's 22 features to 31: V3's 22 (V3's preprocessing) plus the 9 registered physics
  features of V4 (`giants.PHYSICS`), each median-imputed, standardised on the fold's training rows and clipped to
  ±10, with `ruwe` and `n_gaia_within_2as` log-scaled first (`giants.PhysicsScaler`).
- The decision threshold is 0.5, as for V3.

## 3. The comparison

- **New folds:** 5-fold star-grouped cross-validation (`StratifiedGroupKFold`, shuffle) with fold seed **2026**,
  never used before. V3 and V3.1 are **both** retrained on these folds, with the same inner splits and seeds, so the
  comparison is paired KOI by KOI.
- Every KOI is scored once, by the fold that held it out (out-of-fold predictions).
- Intervals: paired bootstrap over **stars** (2,000 resamples, seed 2026), 95%.

## 4. Endpoints and decision rule

**Primary (both must hold for a pass):**
1. **Giants:** recall of confirmed giants (≥ 6 Earth radii) at V3's out-of-fold false-positive rate on the giant
   set, V3.1 minus V3. Pass if the lower end of the 95% interval is **above 0**.
2. **Non-inferiority overall:** accuracy over all KOIs at 0.5, V3.1 minus V3. Pass if the lower end of the 95%
   interval is **above -0.2 points**.

**Secondary (reported, never used to choose):** overall accuracy superiority (lower end above 0); accuracy on
planets under 6 Earth radii; AUC; Brier score; recall above 15 Earth radii; the false-positive rate at 0.5 on giants
(the calibration problem that sank Colossus 2).

## 5. Reporting

Every number, pass or fail, in `docs/star-gazer/V3_1_RESULTS.md`; an independent audit before anything reaches the
README or the star map. Detailed predictions stay local (`results/v3_1/`, git-ignored, committed only encrypted).

## 6. Prospective test (decides adoption)

If the primary endpoint passes, V3 and V3.1 (trained on all labelled KOIs, as V3 was) score every CANDIDATE KOI.
The predictions are saved (`results/v3_1/prospective_<date>.csv`) and their SHA-256 committed, then judged against
NASA's rulings as they arrive (`web/data/resolutions.js`). V3.1 replaces V3 only if it does at least as well there.
Until then the star map keeps V3, and may show V3.1 beside it only labelled **EXPERIMENTAL**.

## 7. V4 (Colossus) from here

Not registered here. If V3.1 passes, a separate giant specialist may not be needed. If a V4c is tried, its own
registration must come first, and it should fix the calibration that failed Colossus 2 (for example calibrating
probabilities on the inner validation split), judged on folds not yet used.

## 8. Changes after registration

(none)
