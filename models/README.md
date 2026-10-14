# Models (not committed)

Trained models are written here and are git-ignored. `v3/` holds the Star Gazer ensemble: five
`star_gazer*.keras` networks, `feature_preprocessor.json` and `threshold.json` (decision threshold and view
version).

- **Train them:** `scripts/pipeline/run_pipeline.py`, or just `scripts/pipeline/train_star_gazer.py --ensemble 5`.
- **Or decrypt the committed copy:** `scripts/tools/secure_artifacts.py unlock` (needs the key; see
  [secure/README.md](../secure/README.md)).

Models trained on an older light-curve recipe are refused when loaded (`StaleModelError`).
