# Plan: Star Gazer V4

**Status: plan** (17 October 2026). **Direction chosen by the user: two specialists.** V3 stays as it is and
keeps the small planets it already finds 96-100% of the time; V4 is a new **giant-planet specialist** that takes
over for big objects. V3 stays frozen (`docs/AUDIT_V3.md`): V4 is a new version with its own
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

## 2. Two specialists: V3 for small planets, V4 for giants

- **V3, unchanged** (frozen), scores everything as today.
- **V4, the giant specialist**, is trained and judged only on big objects: the KOIs above 6 Earth radii
  (2,570 labelled, of which **184 confirmed planets**, 7%; above 15 Earth radii only **24 planets among 2,165**).
  That scarcity is the whole problem, so V4 leans on physics inputs (below) rather than pattern-matching, and adds
  confirmed giant planets from TESS (TFOPWG-confirmed hot Jupiters) to its training set.
- **The hand-off:** a KOI's radius is itself uncertain (it depends on the star's radius), so there is no hard cut.
  Below 6 Earth radii V3 answers; above 10, V4; in between, a blend weighted by radius. The blend's rule is fixed
  before evaluation (section 3).
- **The star map** shows which specialist answered ("small-planet model" / "giant-planet model").

## 3. What the giant specialist uses

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

## 4. How it will be judged (fixed in advance)

- **Pre-registered:** the variants, metrics and decision rules are written into this plan and committed before
  any V4 training. No variant is chosen by its test score.
- **Primary metric:** 5-fold star-grouped cross-validation **on the giant KOIs** (V4 alone, then V3 + V4
  combined over all KOIs, which must not fall below V3 on small planets), plus recall on SNR above 200.
- **Prospective test (new):** every candidate NASA rules on **after** the V4 design is frozen
  (`web/data/resolutions.js` records them, dated). V3's and V4's predictions are saved beforehand, then
  compared as rulings arrive. This is the only test no design choice could have seen.
- **An independent audit** (a fresh agent), as for V3, before any V4 number goes in the README.

## 5. Build order

1. Data: stellar density check, shape metrics, Gaia RUWE, missing flags for the giant KOIs (cheap, from tables and
   existing views); TESS-confirmed giant planets as extra training examples.
2. Train the giant specialist; CV on giants against V3's giant recall; fix the hand-off rule.
3. Difference-image pilot (500 stars); full build only if the pilot helps in CV.
4. Calibration and the conformal band; freeze the design; save predictions for the prospective test.
5. Optional V4.1: TESS fine-tuning and its own evaluation.
6. Audit, README, star map (Star Gazer V4 scores on the map, with the "not sure" band shown honestly).

## 6. Decisions for you

1. TESS: the giant specialist needs TESS's confirmed giants as extra examples (recommended); the full TESS
   fine-tuning stays a later V4.1. OK?
2. Difference images: worth the heavier downloads (a pilot first, recommended)?
3. A name for the giant specialist (e.g. "Star Gazer Giants")?
4. Compute: a laptop CPU like V3 (days of building and training), or would you use a free cloud GPU?
