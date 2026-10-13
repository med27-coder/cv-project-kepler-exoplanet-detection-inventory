# 🛠️ Improvement notes

A backlog of what could make Star Gazer and the Kepler Star Map better. These are ideas, not commitments.
The star map's feature roadmap lives in [STARMAP_PLAN.md](STARMAP_PLAN.md). This file covers the
whole project: data and model, pixel art and UX, performance, security, encryption, code quality
and testing.

Effort: 🟢 small (under an hour) · 🟡 medium (an afternoon) · 🔴 large (days)
Priority: **P1** do next · **P2** worth it · **P3** nice to have

*Written October 2026, during the V3 training run.*

---

## ⚠️ Blocker found while writing these notes

| | Item | Effort |
|---|---|---|
| **P1** | **The encrypted V3 bundle will exceed GitHub's 100 MB file limit.** Each model is ~39 MB and `--ensemble 5` saves five (`star_gazer.keras`, `_1` … `_4`). `.keras` files are already zipped, so the bundle will be ~190 MB. `secure_artifacts.py lock` only warns above 95 MB, and the push would then be rejected. Options: (a) split the bundle into ≤ 90 MB parts, each with its own nonce and tag, with the manifest listing their hashes; (b) attach it to a GitHub Release (2 GB per file, outside git history); (c) Git LFS (1 GB free). **Recommended: (a)**, since it keeps everything in the repo with no LFS quota. | 🟡 |

---

## 1. Data and model

| | Idea | Why | Effort |
|---|---|---|---|
| **P1** | **Checkpoint and resume training**: save each ensemble member and each diagnostic run as it finishes, and skip finished ones on restart. | A PC restart on 2026-10-13 threw away a partly finished run; the trainer always starts from zero. | 🟡 |
| **P1** | **Commit the pipeline script** (`build/readme/pipeline.sh`, which is git-ignored) as `scripts/run_pipeline.py`: train → score → export → CV, with logs. | Makes a full V3 rebuild reproducible for anyone, not just this PC. | 🟢 |
| **P2** | **Gaia features ablation**: add Berger 2020 radius, mass, density and luminosity (already in `data/raw/berger2020_gaia_kepler.csv`, matching 92.7% of KOIs) as model inputs; keep them only if grouped CV improves. | Better stellar parameters help separate eclipsing binaries from planets. | 🟡 |
| **P2** | **Prediction scoreboard**: save each run's candidate scores with a date. When NASA later confirms or rejects a candidate, record whether Star Gazer was right. | An honest test on planets the model never saw. | 🟡 |
| **P2** | **Monthly data refresh** (scheduled GitHub Action): re-download the NASA tables, re-export the map, open a PR if anything changed. | Keeps the map current without manual work; feeds the scoreboard. | 🟡 |
| **P2** | **Catalog sanity report**: list catalog oddities before building, such as K06549.01 (transit longer than its orbit), missing epochs, and periods < 0.3 d. | We found that one only because it crashed the build. | 🟢 |
| **P3** | **Kepler DR25 simulated light curves** (injected, inverted, scrambled) as extra false-alarm and planet examples. | The data NASA's Robovetter was tuned on; tens of GB, so fetch a subset. | 🔴 |
| **P3** | **TESS transfer test**: score TESS objects with the Kepler model. The 94 Kepler planets TESS saw again are a ready-made check set. | First step towards a second mission (V4). | 🔴 |
| **P3** | Use `pl_orblper` (the argument of periastron) for real orbit orientations instead of a fixed random angle. | More faithful eccentric orbits. | 🟢 |

## 2. Unconfirmed planets (the 1,977 candidates)

| | Idea | Effort |
|---|---|---|
| **P1** | **Draw candidate-only systems now** as ghostly hollow planets labelled "unconfirmed"; keep "soon to cross the stars" only until the Star Gazer score arrives. | 🟡 |
| **P2** | **A "case file" per candidate**: NASA's own vetting score next to Star Gazer's, and plain-language red flags ("weak signal", "too big to be a planet", "seen again by TESS ✓"). | 🟡 |
| **P2** | **"Next planets" leaderboard**: the most likely real candidates, plus a separate habitable-zone list. | 🟢 |

## 3. Pixel art and experience

| | Idea | Effort |
|---|---|---|
| **P2** | **Planets grow with zoom** in the overview (sprites stay tiny now, even at 8×). | 🟢 |
| **P2** | **Pinch-zoom and two-finger pan** on phones for both canvases (now wheel, buttons and keys only). | 🟡 |
| **P2** | **Shareable view links**: put zoom, true scale and the selected system in the URL (`#Kepler-90/true/4x`). | 🟢 |
| **P2** | **"Kepler's view" toggle**: an edge-on view where you see the planet cross the star, matching the light-curve strip. | 🟡 |
| **P3** | **Star types drawn differently**: red dwarfs with spots and flares, puffy giants, F stars bluish-white with a bigger glow. | 🟡 |
| **P3** | **Tidally locked hot planets** (period under ~10 days) with a permanent day side and night side. | 🟢 |
| **P3** | **"You are here" depth view**: a side view of the Kepler cone with Earth at the tip and stars at their Gaia distances. | 🟡 |
| **P3** | **Kepler CCD footprint** outline (21 modules) on the map. | 🟢 |
| **P3** | **FPS setting** (60 / 30 / 15 / off), only if 30 fps looks choppy. | 🟢 |
| **P3** | **Colour-blind check** of the temperature palette and map colours with a palette validator; add patterns or labels where colours alone carry meaning. | 🟢 |

## 4. Performance and data size

| | Idea | Effort |
|---|---|---|
| **P3** | **Lazy-load system details**: ship only the star list first (~60 KB of the 240 KB compressed), fetch a system's details on click. Worth it only if the data grows. | 🟡 |
| **P3** | **Pre-rendered sky thumbnails** for the 14 spotlight systems, so most visitors never contact CDS (the only third-party request). | 🟢 |

Already done (October 2026): 30 fps cap, pausing when off-screen or idle, static layers drawn once per view, a 4 KB backdrop, and rebuilding canvases the browser discards (the "bleeding" fix). Measured at ~0.6% of one CPU core and ~295 KB on first visit.

## 5. Security

The current measures are listed in [SECURITY.md](../SECURITY.md): strict CSP, escaping, a clickjacking guard, SHA-pinned actions, CodeQL, pip-audit and Dependabot.

| | Idea | Why | Effort |
|---|---|---|---|
| **P1** | **Finish the GitHub settings checklist** in SECURITY.md: secret scanning and push protection, private vulnerability reporting, a ruleset on `main` blocking force-push and deletion, and 2FA. | Settings, not code, so they can't be done from here. | 🟢 (manual) |
| **P2** | **Lock Python dependencies with hashes** (`pip-compile --generate-hashes`): a `requirements.lock` used by CI and the HF Space. | `>=` ranges let a compromised future release in; hashes make installs reproducible and tamper-evident. | 🟢 |
| **P2** | **OpenSSF Scorecard workflow** (free): a weekly score of branch protection, pinned dependencies, token permissions and so on, with a badge. | Continuous, independent check of the repo's security posture. | 🟢 |
| **P2** | **Signed commits** (SSH signing key on GitHub). | Proves commits on `main` really came from you. | 🟢 |
| **P3** | **Real security headers** via a free proxy (e.g. Cloudflare in front of Pages) for `frame-ancestors`, HSTS and `Permissions-Policy`. | Pages can't send headers; the meta CSP and frame guard cover most of it. Trade-off: adds a third party that sees traffic. | 🟡 |
| **P3** | **Hugging Face Space hardening** when deployed: keep `STAR_GAZER_KEY` only as a Space secret, private Space until reviewed, Gradio's built-in queue limits (already set). | The only server-side part of the project. | 🟢 |

## 6. Encryption and secrets

The current design (`scripts/secure_artifacts.py`) is sound: AES-256-GCM with a random 96-bit nonce, a magic header as associated data, and extraction limited to `models/v3` / `results/v3` with Python's `data` filter (no path tricks).

| | Idea | Why | Effort |
|---|---|---|---|
| **P1** | **Split large bundles** (see the blocker above). | GitHub's 100 MB limit. | 🟡 |
| **P1** | **Back up the key offline** (password manager plus one offline copy) as soon as `keygen` runs. | Without it the encrypted model can never be opened again. | 🟢 (manual) |
| **P2** | **Verify `MANIFEST.json` on unlock**: check the bundle's SHA-256 before decrypting and say clearly which one doesn't match. | GCM already detects tampering; this gives a clearer error and catches a swapped manifest. | 🟢 |
| **P2** | **Bind the version into the encryption**: use `SGV3 + bundle name + created date` as associated data instead of only the magic bytes. | Stops an old bundle being silently swapped in for a new one. | 🟢 |
| **P2** | **Key rotation command**: `rotate` re-encrypts with a new key and keeps the old key until the new bundle is verified. | Needed if the key ever leaks; also for routine hygiene. | 🟢 |
| **P3** | **Optional passphrase-protected key file** (scrypt-wrapped), so the key isn't plain text on disk. | Defence in depth on a shared or stolen laptop. | 🟡 |
| **P3** | **Tighter key-file permissions** (owner-only via `icacls` on Windows, `0600` elsewhere) set by `keygen`. | Other local accounts can't read it. | 🟢 |

## 7. Code quality and review

| | Idea | Effort |
|---|---|---|
| **P2** | **Split `web/starmap.js`** (1,286 lines, one function) into sections or ES modules: map, system view, Solar System, UI. Note: ES modules don't load from `file://`, so either keep a tiny build step or keep one file with clear sections. | 🟡 |
| **P2** | **Run mypy in CI** (configured in `pyproject.toml` but never run) and add type hints to `src/kepler_cnn`. | 🟡 |
| **P3** | Fix the two remaining Ruff notes in `views.py`: `int(round(...))` (RUF046), and the deliberate broad `except` in `process_star`, which needs a `noqa` with a reason. | 🟢 |
| **P3** | **Notebook hygiene**: strip outputs before committing (`nbstripout`) or pair them with plain `.py` files (Jupytext), so diffs are readable. | 🟢 |
| **P3** | Replace progress bars written with carriage returns in logs with `logging`, so log files are readable. | 🟢 |
| **P3** | `CONTRIBUTING.md` plus a short architecture diagram (data → views → model → scores → map). | 🟢 |

## 8. Testing and CI

| | Idea | Effort |
|---|---|---|
| **P1** | **Run the browser regression suite in CI.** The 39 checks in `build/devtools/harness3.*` currently run only on this PC; GitHub's runners ship headless Chrome. The "bleeding" test (`bleed.html`) and the performance check should come along. | 🟡 |
| **P2** | **Canvas snapshot tests**: draw a few systems at fixed times and compare pixel hashes, to catch rendering regressions automatically. | 🟡 |
| **P2** | **Weekly NASA schema check**: download the column headers and fail loudly if NASA renames or drops a column the export uses. | 🟢 |
| **P3** | Test coverage report (`pytest --cov`) in CI. | 🟢 |

## 9. Documentation and presentation

| | Item | Effort |
|---|---|---|
| **P1** | Fill in the README's V3 numbers and charts once training finishes (the template is ready). | 🟢 |
| **P2** | Update the PPTX with V3 results and the star map. | 🟡 |
| **P3** | A data dictionary for `web/data/systems.js` (every field, unit and source). | 🟢 |

---

### Suggested order

1. After training: split-bundle encryption → back up the key → README numbers → push.
2. Training checkpoints plus the committed pipeline script, so a restart never costs a run again.
3. Browser tests in CI, hash-locked dependencies and the GitHub settings checklist.
4. Candidates on the map (draw now, case files, leaderboard).
5. Then pick from the pixel-art and data ideas as time allows.
