# Star Gazer V4, Colossus: results of the pre-registered test

Run on 17 October 2026, exactly as registered in [V4_PREREGISTRATION.md](V4_PREREGISTRATION.md) (no change to the
design, data, metrics or decision rules after training). Scripts: `scripts/pipeline/cross_validate.py --variants
hybrid --save-oof` (V3's baseline) and `scripts/pipeline/v4_giants_cv.py`. Detailed predictions stay local
(`results/v3/cv_oof.npz`, `results/v4/`, git-ignored).

## Verdict: the primary endpoint failed

Colossus (G1) did **not** find more giant planets than V3 at V3's false-alarm rate. It is **not** adopted, and
nothing about it goes in the README's results.

| On the giant set (2,569 KOIs ≥ 6 Earth radii, 184 confirmed), out-of-fold | V3 | Colossus (G1) |
|---|---|---|
| **Primary:** recall at V3's false-positive rate (0.92%) | **81.0%** | **72.3%** |
| Difference, 95% interval (paired bootstrap over stars, 2,000 resamples) | | −8.7 points (−20.1 to +1.1) |
| AUC | 0.985 | 0.973 |
| Recall above 15 Earth radii (24 planets) | 37.5% | 8.3% |
| Brier score (lower is better) | 0.016 | 0.024 |
| Ablation G2 (no physics features): recall at V3's FPR | | 75.0% |
| Combined system's accuracy over all 7,586 KOIs (non-inferiority: within 0.2 points of V3) | 97.02% | 96.80% (fails) |

The V3 baseline is V3's own cross-validation re-run unchanged: 97.02% ± 0.54 accuracy, AUC 0.9935 ± 0.0017,
in line with the published 97.09% ± 0.42 (`results/v3/cv_metrics.json`, untouched).

## What we learned

1. **V3 handles giants better than the single test split suggested.** "1 of 7 real giants above 15 Earth radii"
   came from one split of 1,517 KOIs; across all five folds V3 finds 81% of planets of 6 Earth radii and up at a
   0.9% false-positive rate, and 9 of the 24 above 15. The giant weakness is real but smaller than it looked.
2. **A catalog-only specialist cannot beat a model that reads the light curve.** Colossus saw the catalog
   numbers and the registered physics features but no light-curve views; V3's views carry the transit's shape
   in full, which is what separates a giant planet from an eclipsing binary.
3. **The physics features, as built, add nothing measurable** (G1 72.3% vs G2 75.0%, well inside the noise).

## What a next attempt would need (not started; it would need its own pre-registration)

- Give V3's own network the physics features as extra inputs (a V3 variant), rather than a separate model.
- Or a specialist that also reads the views: V3's architecture fine-tuned on the giant KOIs, plus the physics
  features.
- More real giants to learn from: TESS-confirmed giant planets with their light curves (V4.1 in the plan).
- Any of these is judged on fresh folds and the prospective test, never on this run.
