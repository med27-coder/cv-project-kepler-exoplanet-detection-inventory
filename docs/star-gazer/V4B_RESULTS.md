# Star Gazer V4b, Colossus 2: results of the pre-registered test

Run on 18 October 2026, exactly as registered in [V4B_PREREGISTRATION.md](V4B_PREREGISTRATION.md) (V3's folds, its
inner splits and its out-of-fold predictions; no change after training). Script:
`scripts/pipeline/v4b_colossus2_cv.py`; detailed predictions stay local (`results/v4/`, git-ignored).

## Verdict: mixed. The primary endpoint passed; non-inferiority failed

| On the giant set (2,569 KOIs ≥ 6 Earth radii, 184 confirmed), out-of-fold | V3 | Colossus 2 |
|---|---|---|
| **Primary:** recall at V3's false-positive rate (0.92%) | 81.0% | **86.4%** |
| Difference, 95% interval (paired bootstrap over stars, 2,000 resamples) | | **+5.4 points (+2.2 to +9.8): passes** |
| Recall above 15 Earth radii (24 planets) | 37.5% (9) | 54.2% (13) |
| AUC | 0.985 | 0.985 |
| Brier score (lower is better) | 0.016 | 0.022 |
| Stage A (ablation: physics inside V3, no fine-tuning): recall at V3's FPR | | 86.4% |
| **Combined system's accuracy over all 7,586 KOIs** (must stay within 0.2 points of V3) | 97.02% | **96.69%: fails** |

So Colossus 2 is **not adopted**: a registered requirement failed. As section 1 of the registration warned, this
was also a second test on the same folds.

## Why the two endpoints disagree (exploratory, not registered)

- **Colossus 2 ranks giants better, but its probabilities run high.** Fine-tuned with class weights on the giants
  (7% planets), it calls more binaries planets at the 0.5 threshold: on giants its false-positive rate at 0.5 is
  2.6% against V3's 0.9% (recall 91% vs 81%). To match V3's false alarms its threshold had to be 0.89. That is a
  calibration problem, and it is what costs the combined system its accuracy.
- **Stage A did the work, not the specialist.** The registered ablation (V3's network with the physics features,
  before any fine-tuning) finds the same 86.4% of giants at V3's false-positive rate. Looked at after the fact, it
  also edges V3 on everything else: accuracy 97.36% vs 97.02% over all KOIs, 96.87% vs 96.63% on planets under 6
  Earth radii, AUC 0.9938 vs 0.9932. These comparisons were **not** registered, so they are leads, not results.

## What this points to (would need its own pre-registration)

**Star Gazer V3.1: V3's network with the physics features** (Stage A as the model, for every KOI, no hand-off).
To count, it must be registered first and judged on evidence these folds can't have shaped: cross-validation with a
different fold seed, and above all the **prospective test** against NASA's future rulings
(`web/data/resolutions.js`).
