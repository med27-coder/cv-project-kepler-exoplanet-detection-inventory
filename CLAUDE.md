# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Two projects share this repo: **Star Gazer**, a Kepler exoplanet classifier (Python, TensorFlow), and the
**Kepler Star Map** (`web/`), a static pixel-art site on GitHub Pages that also hosts a collecting game.

## Environment and commands

Windows, Python venv at `.venv` (use `.venv/Scripts/python`, not `python`). The Bash tool is Git Bash.

```powershell
.venv\Scripts\python -m pytest -q                                   # everything (~2 min; browser tests need Playwright Chromium)
.venv\Scripts\python -m pytest -q tests/test_web_data.py::test_resolutions   # one test
.venv\Scripts\python -m ruff check .
.venv\Scripts\python -m mypy src/kepler_cnn scripts app.py           # "KeyError ..." from mypy = corrupt cache: delete .mypy_cache
.venv\Scripts\python scripts\starmap\build_web.py                    # after ANY edit in web/src/ (then --check)
.venv\Scripts\python -m http.server 8000 --directory web             # view the site locally
.venv\Scripts\python scripts\pipeline\run_pipeline.py --list         # V3 ML pipeline steps (--from <step> resumes)
```

CI (`.github/workflows/tests.yml`) runs ruff, mypy, pytest with coverage, `build_web.py --check` and
`node --check web/starmap.js`. Dependencies are hash-locked (`requirements*.lock`, regenerated with
`scripts/tools/lock_requirements.py`; never let it bump unrelated pins silently).

Tooling: the project enables Anthropic's `pyright-lsp`, `typescript-lsp`, `security-guidance`, `frontend-design`,
`claude-md-management` and `claude-security` plugins
(`.claude/settings.json`; configs: `[tool.pyright]` in `pyproject.toml`, root `jsconfig.json`), so edits come back
with diagnostics. Pyright is advisory (8 known numpy/pandas typing quirks); mypy is the type check of record.
The GitHub CLI (`gh`) is installed: use `gh run list` / `gh run view --log-failed` for CI.
Hooks (`.claude/hooks/`, wired in `.claude/settings.json`): `guard_secrets.py` blocks any git command that stages the
key folder or key, pem and env files, and any commit while one is staged; `precommit_secrets.py` is the git
pre-commit hook that checks the real index on every commit (install once per clone with `--install`); `check_web.py` rebuilds `web/starmap.js` after every edit
in `web/src/` and reports a syntax error at once. `/release [minor|patch|major] [notes]` (`.claude/commands/release.md`)
runs the whole release routine below.

Shell gotcha: heredocs passed through the Bash tool mangle backslashes and some quotes. For multi-line Python
patches, write a script file (scratchpad) and run it, or use the Edit tool.

## The ML side (Star Gazer V3)

- `src/kepler_cnn/` is the installed package (`pip install --no-deps -e .`); shared logic lives here, not in
  scripts. Flow: `views.py` (all-quarter light curves -> global/local/odd/even/secondary/centroid views) ->
  `star_gazer.py` (catalog features, star-grouped split, hybrid model, evaluation) -> `training.py` (variants,
  checkpoints, scoring; used by the pipeline, cross-validation and ablation scripts).
- `scripts/` is grouped by job: `pipeline/`, `starmap/`, `experiments/`, `data/`, `tools/` (see `scripts/README.md`).
- The trained model (`models/v3/`) and detailed results (`results/v3/`) are git-ignored and committed only
  encrypted in `secure/` (`scripts/tools/secure_artifacts.py unlock|lock|verify`, key `.secrets/star_gazer.key`,
  never committed). `results/v3_public/` holds the few published outputs.
- **V3's design is frozen**: never tune or pick variants on the test split (`docs/star-gazer/AUDIT_V3.md`). The headline
  estimate is the 5-fold star-grouped CV.
- `README.md` is generated from `build/readme/README.template.md` (git-ignored) by `fill_readme.py`: edit both.

## The star map (`web/`)

**Data, all generated (never hand-edit `web/data/`):**
- `scripts/starmap/export_starmap.py` builds `data/systems.js` (the index loaded up front, budget 400 KB),
  `data/details/NN.js` (32 lazily loaded chunks) and `data/resolutions.js`. Sources: the KOI table
  (`kepler_cnn` catalog), NASA `pscomppars` (matched to KOI stars **by position**, since NASA renames hosts),
  `keplernames` (Kepler IDs; extra systems found outside the KOI list, e.g. Kepler-16), TESS TOIs, Gaia, and
  Star Gazer scores. `resolutions.js` records candidates NASA confirms or rejects, dated when first seen.
- Other generators: `fetch_spacecraft.py` (JPL Horizons), `make_earth_map.py`, `fetch_references.py` (NASA
  photos -> `pixel-art/references/` and `web/gallery/`; images credited to ESA are **linked, never copied**),
  `export_pixel_art.py` (sprites -> `pixel-art/`). A monthly workflow (`data-refresh.yml`) opens a PR with fresh data.

**Page code:** `web/src/*.js` are concatenated in filename order into one IIFE, `web/starmap.js`.
- Function declarations are hoisted across parts, but `const`s are not: code that runs at load and calls into a
  later part must be deferred with `queueMicrotask`.
- Roles: `40-home.js` `lookup()` routes searches (easter eggs before the catalog). `48-gallery.js` owns progress,
  achievements and easter eggs. `48b-predictions`, `48c-egg-facts` (each egg's fun facts and why it's here; every egg needs one), `49-ranks` (emblems, badges, header), `49b-trophies`,
  `49c-ui`, `49d-connect` add on to it; `49e-thanks` is the antenna's thank-you note. `56-universe.js` is the UNIVERSE view (sectors on their own canvas); `47b-dwarfs` the dwarf planets;
  `47c-astronaut` the lost astronaut and outfits, `47d-martian` the Mars farm, `47e-rovers` Curiosity and Perseverance at work (anything a `#hash` search needs must load before `50-wiring`). `60-loop.js` is the only animation loop (it stops when idle or hidden;
  every drawing hooks into it).
- **Strict CSP**: no inline scripts, styles or `style=` attributes in HTML strings (set `el.style` from JS);
  escape every interpolated value with `esc()`.
- The canvas pixel font (`GLYPHS` in `20-system.js`) has only A-Z, digits, space and `. - / ? % : ,`.
- **Saved progress** lives in `localStorage` key `starmap.progress.v1`. Achievement and easter-egg ids must
  never be renamed or removed (`SHIPPED_IDS` in `tests/test_web_data.py`); add new ids there.
- Browser tests (`tests/test_browser.py`, Playwright) run on a fixed clock (time-of-day achievements), and
  `navigator.webdriver` skips the first-visit tour. Pop-ups queue, so waits must allow for that.

## Conventions

- **Releases** (semantic versions, `CHANGELOG.md`): bump `VERSION` and `RELEASE_NOTES` in `web/src/00-version.js`
  (2 or 3 plain-words highlights, no spoilers: the antenna lights up and shows them once per version), add the
  CHANGELOG entry, run `build_web.py` (stamps `?v=` on index.html's links), push, then
  `git tag vX.Y.Z` + `gh release create vX.Y.Z --notes-file <that entry>`. MINOR for features, PATCH for fixes.

- Docs are grouped: `docs/star-gazer/` (the model: audit, analysis, V4 pre-registrations and results),
  `docs/star-map/` (the site: data dictionary, easter eggs, game design, roadmap).
- Plans for upcoming features live in `docs/plans/` (`docs/plans/README.md` is the planner); some are kept on
  local plan branches until building starts. Spoilers and the game design: `docs/star-map/EASTER_EGGS.md`,
  `docs/star-map/STAR_GAZER_MISSION.md`.
- Pixel art: concept drafts in `pixel-art/emblems/` and `pixel-art/concepts/` (generated by `draft_*.py`);
  hand-made drafts are `draft_*.png`. **Before replacing, redrawing or dropping any pixel art (sprites, drafts, `web/og.png`,
  the loading screen), copy the current version into `pixel-art/archive/`** with a row in its README. Only commit images whose licence allows it (NASA, ESA Gaia ODbL, DSS2).
