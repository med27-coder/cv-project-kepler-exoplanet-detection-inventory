# Independent audit of the V3 results (13 October 2026)

After training, the V3 numbers were checked by a separate agent session with no involvement in
building the model. It had read-only access and trained nothing. The question: are the reported
test results genuine, or inflated by leakage, tuning on the test set, or repeated re-runs?

**Verdict: genuine** (high confidence, ~85%). There was no leakage, no test-set tuning and no
re-rolling. The headline is an honest held-out estimate **for the task it measures**: confirmed
planets vs false positives, on stars never seen in training.

| Check | Result | Evidence |
|---|---|---|
| Recompute the metrics from the saved test predictions | Pass | Accuracy 0.9723, AUC 0.9936, precision 0.9568, recall 0.9672 (threshold 0.5), and 0.9763 accuracy at the validation-chosen 0.70: all identical to `results/v3/metrics.json` (n = 1,517) |
| Rebuild the split independently | Pass | Same 7,586 KOIs on 6,640 stars, same 4,855 / 1,214 / 1,517 split, same test KOIs |
| Stars shared between train / validation / test | Pass | None (`StratifiedGroupKFold` grouped by Kepler ID); planet share 36% in each split |
| Near-duplicate signals across splits | Pass | 254 test false positives have an "ephemeris twin" on another star in training (contamination). Accuracy is the same with or without them (0.9724 vs 0.9723) |
| Inputs that encode NASA's verdict | Pass | The final model uses no vetting outputs (no `koi_score`, dispositions, false-positive flags or Robovetter statistics). Those appear only in a labelled comparison model, which isn't saved |
| Light-curve views use the label | Pass | Every KOI's transits are masked the same way, whatever its disposition |
| Choices made on the test set | Pass | Early stopping and learning-rate schedule use validation; the 0.70 threshold is chosen on validation; feature scaling is fitted on training only |
| Stale or mixed files | Pass | All results and models are from the same run; the data recipe (view version 3) matches the code |
| Cross-validation (5 star-grouped folds, finished after the audit) | Pass | Single network: accuracy 97.09% ± 0.42, AUC 0.9935 ± 0.0015; fold 1 is the headline split, folds 2–5 are new and agree |
| Re-runs tuned against the same test split | Low risk | Since V3 began, features, architecture, split and seed are unchanged; the run is deterministic (the run before a PC restart gave bit-identical numbers). Estimated optimism ≤ 0.5 points, within the statistical margin |

**In context:**

| Reference | Test accuracy | AUC |
|---|---|---|
| Always guessing "false positive" | 63.8% | |
| Gradient boosting on the 22 catalog features | 95.1% | 0.988 |
| NASA's own vetting score (`koi_score`), same test KOIs (n = 1,339) | 96.8% | 0.981 |
| **Star Gazer V3 (5-network ensemble)** | **97.2%** (95% interval ≈ 96.4–98.1%) | **0.994** |

## Caveats (not inflation, but needed to read the number fairly)

- **Resolved cases only.** The 97% is measured on KOIs NASA has already confirmed or rejected. The 1,977
  open candidates are the hard, ambiguous cases, so this is not the accuracy on brand-new signals.
- **`koi_count`** (number of KOIs on the star) partly reflects *how* NASA confirmed planets:
  multi-planet systems were statistically validated in bulk. On its own it predicts the label with
  78% accuracy. Measured impact on the final model is small (catalog-only models: 95.1% with it vs
  94.5% without). An ablation without it is planned.
- **Missing values differ by label.** False positives more often have missing fits or older parameter
  deliveries. Restricting the test set to cases without these artefacts doesn't change the result
  (accuracy 0.9735, AUC 0.996 on 791 single-KOI, DR25-only stars).
- **Cross-validation fold 1 is the headline split**, and CV trains single networks rather than the
  ensemble, so its mean describes one network over five splits.

## What a fully clean estimate needs

Design choices are now frozen (features, architecture, ensemble of 5, view version 3, threshold rule).
The cleanest test is KOIs NASA decides *after* the 6 October 2026 catalog snapshot, which no run has ever
seen. `scripts/scoreboard.py` records every candidate's score with a date and checks them against
NASA's later dispositions; the monthly `data-refresh` workflow runs that check. On 14 October none had
been decided yet.
