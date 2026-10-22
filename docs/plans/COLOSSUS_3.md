# Plan: a more accurate Colossus (Colossus 3)

**Status: plan only (21 October 2026).** Nothing is trained until the user picks a path, and then a pre-registration
comes first (like [V4B_PREREGISTRATION.md](../star-gazer/V4B_PREREGISTRATION.md)), judged on folds no earlier attempt
has seen. V3 stays the model of record either way.

## 1. What the three registered attempts taught us

| Attempt | Giants found at V3's false-alarm rate | Overall | Verdict |
|---|---|---|---|
| Colossus (catalogue numbers only, a tree model) | 72% vs V3's 81% | | failed: without the light curve it can't see the transit's shape |
| Colossus 2 (V3's network + physics features, fine-tuned on giants) | **86.4%** vs 81.0% | 96.69% vs 97.02%: **failed** | ranks giants better, but its probabilities run high |
| V3.1 (the same network for every KOI, fresh folds) | 82.6% vs 83.7% | 96.95% vs 97.18% | failed: the earlier lead did not replicate |

Two lessons stand out:

- **Ranking is not the problem; calibration is.** Colossus 2 sorts giants well (better than V3 at the same false-alarm
  rate), but at 50% it calls a binary star a planet about three times as often as V3 (2.6% vs 0.9% of giants), and on
  the map's candidates it calls 33% of giants planets where V3 calls 16%. That one flaw is what failed its test.
- **The data is small.** There are only 184 confirmed giants. A difference of a few points in recall is within the
  noise (one standard error is about 3 points), so a real gain must be large, or tested on more evidence.

## 2. Ideas, cheapest first

### A. Fix the calibration (no new model)
- **Temperature scaling or isotonic regression**, fitted on each fold's inner validation giants only (never the
  test fold), so a 50% score means about 50%. This keeps Colossus 2's ranking (its 86%) and should stop the
  over-calling that cost the combined accuracy.
- **Drop the class weights in fine-tuning** (they told it planets were rarer than they are, so it over-called), or
  use a focal loss.
- **Expected effect:** the combined system's accuracy back to V3's level or better, giant recall kept. This is the most
  likely single win.

### B. Better evidence for giants (new features)
Most giant false positives are eclipsing binaries, often a background star blended into the pixel. Signals that tell
them apart, in order of expected value:
- **Difference images**: where on the camera the light dims during transit. An offset from the target star is the
  strongest sign of a background binary. Heavier downloads (the target pixel files); a pilot on 200 KOIs first.
- **Out-of-transit variability**: ellipsoidal swelling and Doppler beaming, which a close binary shows across its
  whole orbit and a planet barely does.
- **Secondary eclipses away from phase 0.5** (eccentric binaries), widening today's secondary view.

### C. More and better training examples
- **Injection and recovery:** add synthetic giant transits and synthetic binaries into real Kepler light curves, so the
  model sees thousands of labelled giants instead of 184. A standard technique in the field (Kepler's own pipeline was
  tested this way).
- **Augmentation** of the real giants (small phase shifts, added noise at Kepler's noise level).

### D. Combine instead of hand off
- **Stacking:** a small calibrated model that takes V3's and Colossus's scores (plus the planet's radius) and learns
  how much to trust each, fitted on inner folds. Replaces the fixed 6 to 10 Earth-radii blend.
- **A few seeds averaged** (an ensemble) to steady a model trained on so few giants.

## 3. How it would be judged (the registration's backbone)

- **New folds:** a fold seed never used by V3, Colossus, Colossus 2 or V3.1.
- **Primary endpoints, both required:** (1) recall of confirmed giants at V3's false-alarm rate, better than V3;
  (2) the combined system's accuracy over all KOIs no worse than V3's minus 0.2 points.
- **Secondary:** Brier score and expected calibration error on giants (the flaw being fixed), AUC, recall above 15
  Earth radii.
- **The prospective test:** NASA's rulings since 14 October 2026 (`web/data/resolutions.js`) on candidates neither
  model has seen ruled. Small at first, but it can't be shaped by any choice we make.
- **Honest limits stated up front:** with 184 giants, a gain under about 5 points is not distinguishable from noise.

## 4. Suggested path

1. **Colossus 3a = A only** (calibration and no class weights), registered and run first: days on the laptop CPU, no
   new data, and it targets the exact reason Colossus 2 failed.
2. If it passes, it can replace Colossus 2 as the EXPERIMENTAL switch on the map, and it becomes a candidate to adopt.
3. Then **B** (a difference-image pilot) and **C** (injections) as a Colossus 3b, each with its own registration.

## 5. Decisions for the user

1. Start with 3a (calibration only), or go straight to a bigger 3b with new features?
2. Difference images: worth the heavier downloads (a pilot first, recommended)?
3. Injection and recovery: add synthetic giants to training (more work, likely the biggest long-term gain)?
4. Compute: keep to the laptop CPU (days per attempt), or use a free cloud GPU for 3b?
