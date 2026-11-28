# Scripts

Run them from the repository root, e.g. `.venv\Scripts\python scripts\pipeline\train_star_gazer.py`.
Each script's docstring explains its options; most take `--help`. Shared code lives in the
`kepler_cnn` package (`src/kepler_cnn/`), not in other scripts.

| Folder | What it's for | Scripts |
|---|---|---|
| [`pipeline/`](pipeline/) | Build the data, train, evaluate and score Star Gazer V3 | `run_pipeline.py` (everything, in order, resumable), `check_catalog.py`, `build_full_dataset.py`, `train_star_gazer.py`, `score_candidates.py`, `cross_validate.py` (`--save-oof` keeps every KOI's out-of-fold score, the V4 baseline), `scoreboard.py`; V4 Colossus tests: `v4_giants_cv.py`, `v4b_colossus2_cv.py` (see `docs/star-gazer/`) |
| [`starmap/`](starmap/) | Make the Kepler Star Map's data and images (`web/`) | `export_starmap.py`, `build_web.py`, `fetch_spacecraft.py`, `make_og_image.py`, `make_sky_backdrop.py`, `make_sky_thumbs.py`, `make_ccd_footprint.py`, `export_pixel_art.py` (sprites → `pixel-art/`), `fetch_references.py` (official reference images), `make_earth_map.py` (Blue Marble → pixel Earth), `draft_emblems.py` (concept rank emblems), `make_readme_media.py` (the README's banner, screenshots and link previews, captured from the live page → `docs/media/`, `web/og.png`), `make_loading_art.py` (the loading screen's rocket), `draft_concepts.py` (concept art → `pixel-art/concepts/`) |
| [`experiments/`](experiments/) | Follow-up experiments, analysis and charts on the trained model | `analyze_results.py` (where the model succeeds and fails), `ablation_features.py`, `tess_transfer.py`, `plot_version_progress.py` |
| [`data/`](data/) | Download or check outside data | `fetch_gaia_ruwe.py` (Gaia DR3 binarity for KOI stars), `fetch_extra_data.py`, `check_nasa_schema.py`, `import_colab_checkpoints.py` |
| [`accounts/`](accounts/) | The star map's player accounts (local Supabase, `docs/plans/ACCOUNTS_AND_ACCESS.md`) | `manage.py` (`create-tester` and `role`: tester accounts, passwords only to `.secrets/`; `backup` and `restore --yes`: every account and its progress, to and from `.secrets/db-backups/`); `build_catalog.py` (writes the migration that adds new achievement and easter-egg ids to the database's catalog; `--check` in the tests) |
| [`knowledge/`](knowledge/) | The map's knowledge about each world (`knowledge/`, `docs/plans/KNOWLEDGE_AND_RESEARCHERS.md`) | `enrich.py` (a world's computed fields from NASA's values: size class, starlight, year, habitable zone, similar worlds; `--write` fills only the generated block of `knowledge/worlds/<world>.md`) |
| [`tools/`](tools/) | Security and maintenance | `secure_artifacts.py` (encrypted model), `lock_requirements.py` (hash-locked dependencies), `make_hf_space.py` (Hugging Face demo bundle) |

The whole V3 pipeline: `scripts\pipeline\run_pipeline.py` (`--list` shows the steps, `--from <step>` resumes).
