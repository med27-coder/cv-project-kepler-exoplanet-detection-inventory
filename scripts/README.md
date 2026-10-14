# Scripts

Run them from the repository root, e.g. `.venv\Scripts\python scripts\pipeline\train_star_gazer.py`.
Each script's docstring explains its options; most take `--help`. Shared code lives in the
`kepler_cnn` package (`src/kepler_cnn/`), not in other scripts.

| Folder | What it's for | Scripts |
|---|---|---|
| [`pipeline/`](pipeline/) | Build the data, train, evaluate and score Star Gazer V3 | `run_pipeline.py` (everything, in order, resumable), `check_catalog.py`, `build_full_dataset.py`, `train_star_gazer.py`, `score_candidates.py`, `cross_validate.py`, `scoreboard.py` |
| [`starmap/`](starmap/) | Make the Kepler Star Map's data and images (`web/`) | `export_starmap.py`, `build_web.py`, `fetch_spacecraft.py`, `make_og_image.py`, `make_sky_backdrop.py`, `make_sky_thumbs.py`, `make_ccd_footprint.py`, `export_pixel_art.py` (sprites → `pixel-art/`) |
| [`experiments/`](experiments/) | Follow-up experiments, analysis and charts on the trained model | `analyze_results.py` (where the model succeeds and fails), `ablation_features.py`, `tess_transfer.py`, `plot_version_progress.py` |
| [`data/`](data/) | Download or check outside data | `fetch_extra_data.py`, `check_nasa_schema.py`, `import_colab_checkpoints.py` |
| [`tools/`](tools/) | Security and maintenance | `secure_artifacts.py` (encrypted model), `lock_requirements.py` (hash-locked dependencies), `make_hf_space.py` (Hugging Face demo bundle) |

The whole V3 pipeline: `scripts\pipeline\run_pipeline.py` (`--list` shows the steps, `--from <step>` resumes).
