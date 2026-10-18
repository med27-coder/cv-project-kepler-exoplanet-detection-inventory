# Star Gazer V3.1: results of the pre-registered test

Run on 18 October 2026, exactly as registered in [V3_1_PREREGISTRATION.md](V3_1_PREREGISTRATION.md) (script
`scripts/pipeline/v3_1_cv.py`, committed before training): 5-fold star-grouped cross-validation on new folds (seed
2026, never used before), with V3 and V3.1 both retrained in every fold on the same inner splits and seeds, and a
paired bootstrap over stars (2,000 resamples). Nothing was changed after training.

## Verdict: failed. Both primary endpoints failed, so V3.1 is not adopted and Star Gazer stays V3

| Out-of-fold, all 7,586 KOIs (giant set: 2,569 KOIs ≥ 6 Earth radii, 184 confirmed) | V3 | V3.1 |
|---|---|---|
| **Primary 1:** giant recall at V3's false-positive rate on giants (0.92%) | 83.7% | 82.6% |
| Difference, 95% interval | | **-1.1 points (-4.5 to +2.5): fails** (needed the lower end above 0) |
| **Primary 2:** accuracy over all KOIs at 0.5 | 97.18% | 96.95% |
| Difference, 95% interval | | **-0.22 points (-0.45 to 0.00): fails** (needed the lower end above -0.20) |
| Accuracy on planets under 6 Earth radii | 96.72% | 96.47% |
| AUC, all KOIs | 0.9941 | 0.9936 |
| Brier score, all KOIs (lower is better) | 0.0229 | 0.0241 |
| Giant recall above 15 Earth radii (24 planets) | 62.5% | 45.8% (at V3's false-positive rate) |
| False-positive rate on giants at 0.5 | 0.92% | 1.13% |
| Overall superiority (secondary) | | no |

Since the primary endpoint failed, the prospective test (section 6 of the registration) is not run: V3 keeps
scoring the candidates on the star map.

## What this means (exploratory, not registered)

- **The earlier lead did not replicate.** On V3's original folds (seed 42), the same model, Colossus 2's Stage A,
  looked better than V3 on giants and a little better overall ([V4B_RESULTS.md](V4B_RESULTS.md)). On fresh folds it
  is slightly worse on everything. The earlier edge was most likely the luck of one particular split: exactly the
  trap the registration was written to catch, by insisting on folds that could not have shaped the idea.
- **V3 itself held up.** Retrained from scratch on new folds, V3 scored 97.18% (its published 5-fold estimate is
  97.02% ± 0.54), so the headline number is not a lucky split either.
- **Training length tells us little:** V3.1's networks stopped after 16 to 24 epochs, V3's after 16 to 29 (V3.1
  earlier in three folds, later in two). Too mixed to read anything into.

## Reporting notes

- Every registered number is in the table above; the full output is `results/v3_1/analysis.json` and the
  out-of-fold predictions `results/v3_1/cv_oof.npz`, both kept local (git-ignored), as for V4.
- **One difference from section 5 of the registration:** it said the detailed predictions would be committed
  encrypted. The encryption tool (`scripts/tools/secure_artifacts.py`) only covers V3's model and results, so they
  stay local instead. This changes nothing about the analysis or the verdict.

## Where Star Gazer goes from here

Three registered attempts to improve on V3 for giant planets (Colossus, Colossus 2, V3.1) have not beaten it. V3
stays the model. Any V4c or V3.2 needs its own registration first, judged on folds not yet used and on NASA's future
rulings (`web/data/resolutions.js`).
