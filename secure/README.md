# Encrypted V3 model and results

The repository is public, but the trained V3 model (`models/v3/`) and the detailed results (`results/v3/`)
are committed only here, encrypted:

| File | What it is |
|---|---|
| `star_gazer_v3.partNN.enc` | The bundle, AES-256-GCM, in parts under GitHub's 100 MB file limit. Each part is authenticated together with its position, so parts can't be swapped, dropped or reordered |
| `MANIFEST.json` | The parts' SHA-256 hashes, bundle id and date (checked before decrypting) |

**To use the model** you need the key, either the file `.secrets/star_gazer.key` (never committed) or the
`STAR_GAZER_KEY` environment variable:

```powershell
.venv\Scripts\python scripts\tools\secure_artifacts.py verify     # parts match the manifest
.venv\Scripts\python scripts\tools\secure_artifacts.py unlock     # -> models/v3 + results/v3
```

Without the key, retrain instead (`scripts/pipeline/run_pipeline.py`). After retraining, `lock` re-encrypts.
Other commands: `rotate` (new key), `protect` (passphrase on the key file), `status`. Details in
[SECURITY.md](../SECURITY.md).
