# Star Gazer V4, Colossus (giant-planet specialist): pre-registration

Written and committed on 17 October 2026, **before any V4 model was trained**. Design, data, metrics and the
decision rules below are fixed; any change after training starts is listed in section 8 with its reason and
date, and results are reported for the design as registered. Plan: [plans/STAR_GAZER_V4.md](plans/STAR_GAZER_V4.md).

## 1. Question

Does a specialist trained only on big objects find more of the real giant planets than V3, at the same rate of
false alarms, without hurting V3's results on everything else?

## 2. Population

- **Labelled KOIs** (CONFIRMED = 1, FALSE POSITIVE = 0) that have current V3 views: the same set V3 uses.
- **The giant set G:** those with `koi_prad` ≥ 6 Earth radii (2,570 labelled KOIs in the catalog, 184
  confirmed; slightly fewer with views). KOIs without `koi_prad` stay with V3.

## 3. Evaluation design

- **Folds:** exactly V3's cross-validation folds: `StratifiedGroupKFold(5, shuffle=True, random_state=SEED)` over
  all labelled KOIs, grouped by star. V3's out-of-fold predictions come from re-running V3's own CV procedure
  unchanged (`cross_validate.py --variants hybrid --save-oof`), so every KOI has a V3 score and a V4 score from
  models that never saw it.
- **Training inside a fold:** V4 learns only from giant KOIs in that fold's training stars.
- **V3's test split is not used for anything.**

## 4. The model (fixed, no tuning)

**G1, the registered model:** a gradient-boosted tree classifier (scikit-learn `HistGradientBoostingClassifier`,
which handles missing values natively; learning rate 0.05, at most 400 iterations, 15 leaves, 20 samples per
leaf, L2 1.0, early stopping on 15% of the fold's training data with 30 rounds of patience, balanced class
weights, random state SEED + fold). Inputs:
1. V3's 22 catalog features, raw (no NASA dispositions, scores or false-positive flags; no Robovetter diagnostics);
2. a "was missing" flag for each of them;
3. physics features:
   - `log_rho_ratio`: log10(`koi_srho` / 1.41) − Gaia's log density (Berger et al. 2020): transit vs star;
   - `grazing`: `koi_impact` + `koi_ror` (above 1: the companion only grazes the star);
   - `depth_consistency`: log10(depth / `koi_ror`²): a diluted or blended signal disagrees;
   - `u_shape`: the local view's mean over the central half of the transit relative to its minimum (U ≈ 1, V lower);
   - `odd_even`: the difference between the odd- and even-transit depths (views scaled by the primary depth);
   - `secondary_depth`: the deepest dip in the secondary-eclipse view, relative to the primary;
   - Gaia DR3 `ruwe`, the number of Gaia sources within 2", and a flag when either is missing.

**G2, a reported ablation only:** G1 without the physics features (3). It is never used to choose the model.

## 5. Hand-off (combined system)

For a KOI of radius r: w = clip((r − 6) / 4, 0, 1); P = (1 − w) · P_V3 + w · P_V4. Below 6 Earth radii V3 alone,
above 10 V4 alone, a linear blend in between. Missing radius: V3 alone.

## 6. Endpoints and decision rules

- **Primary:** on G, recall of confirmed planets by V4 **at V3's false-positive rate** (V3 at threshold 0.5 on G;
  V4's threshold set to give the same FPR), compared with V3's recall. The difference's 95% interval comes from a
  paired bootstrap over stars (2,000 resamples). **V4 succeeds if the interval's lower end is above 0.**
- **Secondary:** AUC on G; recall on KOIs ≥ 15 Earth radii; Brier score on G; the combined system's accuracy over
  all labelled KOIs at threshold 0.5, which must stay within 0.2 points of V3's out-of-fold accuracy
  (non-inferiority); G2's numbers, to show what the physics features add.
- **Prospective:** once these results are in, the combined system and V3 each score every CANDIDATE KOI; the
  predictions are saved (`results/v4/prospective_<date>.csv`, with a SHA-256 committed) and judged later against
  NASA's rulings (`web/data/resolutions.js`).
- **Exploratory, after the primary analysis:** G1 plus TESS-confirmed giant planets as extra training examples,
  and difference images (plan step 3). Reported as exploratory, never as the headline.

## 7. Reporting

All numbers above, whatever they show, including a failed primary endpoint. An independent audit (a fresh agent)
before anything goes in the README.

## 8. Changes after registration

- 17 October 2026: the specialist is named **Colossus** (the user's choice). A name only; nothing in the design changed.

Results: [V4_RESULTS.md](V4_RESULTS.md) (primary endpoint failed; reported as registered).
