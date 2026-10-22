# Tests

```powershell
.venv\Scripts\python -m pytest -q                       # everything (~2 minutes)
.venv\Scripts\python -m pytest -q tests/test_browser.py # just one file
```

They use small synthetic data and need no NASA downloads. The browser tests need Playwright's Chromium
(`python -m playwright install chromium`) and are skipped without it. CI runs all of them on every push.

| File | What it checks |
|---|---|
| `test_views.py` | Light-curve views built from synthetic Kepler-like data: shapes, eclipsing-binary signatures, odd cases (e.g. a "transit" longer than its orbit) |
| `test_star_gazer.py` | Model plumbing: splits by star, feature scaling, training, checkpoint resume, saliency, the Hugging Face bundle check |
| `test_project.py` | Terms of Use gate and dataset de-duplication |
| `test_app_security.py` | The Streamlit demo refuses bad KOI names and out-of-range inputs; its page, run headless with Streamlit's test harness, explains a missing model and insists on the Terms |
| `test_secure_artifacts.py` | The encrypted model bundle: round trip, tampering, swapped/dropped parts, wrong key, passphrase, rotation |
| `test_pipeline_tools.py` | Catalog sanity report, prediction scoreboard, pipeline runner |
| `test_analysis.py` | Error-analysis helpers (slice statistics, intervals) |
| `test_export_starmap.py` | Star map data export: matching NASA tables, TESS, Gaia, chunks, leaderboard |
| `test_web_data.py` | The committed map data and page: structure, size budgets, security policy, build in sync |
| `test_browser.py` + `browser/harness.js` | The real page in headless Chromium: search, zoom, easter eggs, on-demand loading, trails fix, clickjacking guard |
| `test_palette.py` | Meaningful colours stay distinguishable under simulated colour blindness |
| `test_notebooks.py` | The notebooks' plain-Python mirrors match the notebooks |
