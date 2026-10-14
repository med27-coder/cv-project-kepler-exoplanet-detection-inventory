# V3 experiments

Follow-up experiments on the trained V3 model. Each was run once, with the design choices already
frozen (see [AUDIT_V3.md](AUDIT_V3.md)). Results are reported as measured, including the unflattering ones.

## TESS transfer test (13 October 2026)

**Question:** does Star Gazer still recognise Kepler planets when it sees them through a different
telescope?

**Method** (`scripts/tess_transfer.py`):
- Started from the Kepler planets that NASA's TESS satellite re-detected (TOI disposition KP; same
  star within 3″, period within 1%): 93 pairs.
- Took the first 40 and downloaded 4 TESS sectors each from MAST (SPOC / TESS-SPOC light curves).
- Binned the TESS data to Kepler's 29.4-minute cadence and built the same views, using TESS's own
  transit times.
- Scored them with the V3 ensemble. The catalog features stay the Kepler ones.

| Group | n | Called "planet" with Kepler data | Called "planet" with TESS data | Same verdict |
|---|---|---|---|---|
| All 40 (all CONFIRMED) | 40 | 75% | 65% | 85% |
| Never seen in training (test split) | 7 | 71% | 71% | 100% |
| Seen in training / validation | 33 | 76% | 64% | 82% |

The median change in probability is 0.05, and the correlation between the two scores is 0.58.

**What it shows**

- **The views transfer.** For most planets the verdict from TESS data matches the one from Kepler
  data, even though the model never saw a TESS light curve.
- **TESS's noisier data costs some planets.** TESS's smaller aperture gives noisier light curves, and
  four sectors are much less data than Kepler's four years. Kepler-42-like small signals (e.g.
  KOI-42.01: 0.99 with Kepler data, 0.01 with TESS) get lost.
- **A weakness, not caused by TESS.** These are the planets TESS could re-detect: mostly large planets
  with deep transits. Even with Kepler data, only 75% are called planets, against 96.7% recall on the
  full test set. Deep, V-shaped transits of giant planets around bright stars resemble eclipsing
  binaries, and Star Gazer is less sure about them (Kepler-13 b scores 0.03).
- **Caution:** 33 of the 40 planets were in Star Gazer's training data, so the Kepler-side scores are
  optimistic for them. Only the 7 test-split planets are a clean comparison, and 7 is too few to
  measure anything precisely. Treat this as a feasibility check for a TESS version (V4), not a
  measured TESS accuracy.

**Next:** for V4, fine-tune on TESS light curves, add giant-planet and bright-star examples to the
training mix, and evaluate on TOIs that were never Kepler training data.

## Feature ablations (14 October 2026)

**Question:** does adding Gaia's stellar properties help? And does the model lean on `koi_count`, the
input the audit flagged as partly reflecting how NASA confirmed planets?

**Method** (`scripts/ablation_features.py`): one hybrid network per variant, on the same star-grouped
split and seed as the first ensemble member, compared on the same 1,517 test KOIs. The key reference is
the **spread of the five standard networks**, which differ only by random seed: accuracy 96.51–97.43%,
AUC 0.9919–0.9941. A variant is only "different" if it lands outside that range.

| Variant | Accuracy | AUC | Precision | Recall |
|---|---|---|---|---|
| Standard features, same seed | 96.51% | 0.9923 | 93.4% | 97.3% |
| Standard features, range over 5 seeds | 96.51–97.43% | 0.9919–0.9941 | | |
| **+ Gaia stellar properties** (92% of KOIs matched) | 97.43% | 0.9936 | 96.7% | 96.2% |
| **− `koi_count`** | 96.90% | 0.9908 | 95.5% | 96.0% |

**What it shows**

- **Gaia: no clear gain.** +0.9 points over the same-seed network looks like a win, but that network was
  the weakest of the five. 97.43% equals the best standard network, and the AUC sits inside their range.
  Picking Gaia on this split would also be choosing a design by its test score, the selection the audit
  warned against. Gaia stays a candidate for V4, to be judged by cross-validation on fresh splits.
- **`koi_count`: the model doesn't depend on it.** Removing it leaves accuracy inside the normal range,
  with AUC only slightly lower (0.9908 vs 0.9919–0.9941). The audit's concern about this input has a small
  practical effect.
- **Design unchanged.** V3 keeps its frozen feature set; these runs are documented, not adopted.
