# Plan: Star Gazer V4

**Status: plan** (17 October 2026). V3 stays frozen (`docs/AUDIT_V3.md`): V4 is a new version with its own
design, decided **before** it is evaluated, judged by cross-validation on fresh star-grouped splits and by a
**prospective test** (below), never by tuning on V3's test split.

## 1. What V4 has to fix (from V3's own analysis)

| Weakness | Evidence | Source |
|---|---|---|
| **Giant planets** | above 15 Earth radii, only 1 of 7 real planets found (436 of 443 KOIs that big are eclipsing binaries) | `docs/DATA_ANALYSIS.md` |
| **Deep, V-shaped transits** | recall 88% for SNR above 200; Kepler-13 b scores 0.03 | `DATA_ANALYSIS.md`, `EXPERIMENTS_V3.md` |
| **Another telescope** | TESS light curves lose small signals (KOI-42.01: 0.99 with Kepler, 0.01 with TESS) | `EXPERIMENTS_V3.md` |
| **Missing catalog values** | a missing fit can read as evidence of a false positive | `DATA_ANALYSIS.md` |
| **Contamination** | the confident false alarms point to light from a neighbouring star | `DATA_ANALYSIS.md` |
| **Bookkeeping signals** | `koi_count` and default stellar values partly reflect how NASA confirmed planets | `AUDIT_V3.md` |

## 2. What V4 adds

1. **Physics that separates planets from binaries** (the giant-planet fix):
   - *stellar density check:* the transit's shape implies a star density; compare it with Gaia's. An eclipsing
     binary or a blend usually disagrees (the "photo-eccentric" consistency test);
   - *transit shape:* U (planet) vs V (grazing binary) as a measured input, and the ratio of depth to duration;
   - *phase curve view:* a binned full-orbit view at higher resolution to catch ellipsoidal variation and
     reflected light from a companion star;
   - *Gaia binarity:* RUWE (how well a single-star model fits Gaia's astrometry) flags unresolved companions.
2. **Missing values made explicit:** a "was missing" flag beside every catalog input; stellar values that
   are only defaults are marked.
3. **Difference images** (the contamination fix): Kepler's pixel data show where the light dropped (on the
   target, or on a neighbour), as ExoMiner++ uses. A new view built from target pixel files (heavier
   downloads: a pilot on 500 stars first).
4. **Balanced giants:** weight or add confirmed giant planets (Kepler plus confirmed hot Jupiters from other
   surveys) so "big" stops meaning "binary".
5. **TESS (optional V4.1):** fine-tune on TESS light curves of TOIs with a TFOPWG verdict (confirmed planet or
   false positive), evaluated on TOIs that were never Kepler training data.
6. **Uncertainty you can trust:** calibrated probabilities (temperature scaling on validation) and a
   *conformal* "not sure" band: the model says "can't tell" instead of guessing, with a guaranteed error rate.

## 3. How it will be judged (fixed in advance)

- **Pre-registered:** the variants, metrics and decision rules are written into this plan and committed before
  any V4 training. No variant is chosen by its test score.
- **Primary metric:** 5-fold star-grouped cross-validation (as V3's headline), plus **recall on giant planets**
  and on SNR above 200 as named secondary metrics.
- **Prospective test (new):** every candidate NASA rules on **after** the V4 design is frozen
  (`web/data/resolutions.js` records them, dated). V3's and V4's predictions are saved beforehand, then
  compared as rulings arrive. This is the only test no design choice could have seen.
- **An independent audit** (a fresh agent), as for V3, before any V4 number goes in the README.

## 4. Build order

1. Data: stellar density check, shape metrics, Gaia RUWE, missing flags (cheap, from tables and existing views).
2. CV of V3 + the new features (the giant-planet fix), against V3's CV numbers.
3. Difference-image pilot (500 stars); full build only if the pilot helps in CV.
4. Calibration and the conformal band; freeze the design; save predictions for the prospective test.
5. Optional V4.1: TESS fine-tuning and its own evaluation.
6. Audit, README, star map (Star Gazer V4 scores on the map, with the "not sure" band shown honestly).

## 5. Decisions for you

1. Scope: Kepler only for V4 (recommended), with TESS as a later V4.1? Or TESS from the start?
2. Difference images: worth the heavier downloads (a pilot first, recommended)?
3. Should the star map show V4 next to V3 (a switch), or replace V3 once V4 is audited?
4. Compute: a laptop CPU like V3 (days of building and training), or would you use a free cloud GPU?
