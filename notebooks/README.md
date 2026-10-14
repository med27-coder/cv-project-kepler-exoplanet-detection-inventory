# Notebooks

| Notebook | What it is |
|---|---|
| `Exoplanet_Detection_V3_StarGazer.ipynb` | **V3 Star Gazer**: all-quarter views, catalog features, ensemble, saliency. The current version |
| `Exoplanet_Detection_V2.ipynb` | V2: the AstroNet-style CNN on one Kepler quarter per star, run locally in VS Code |
| `archive_colab/` | The original Colab notebooks (V1, V1.5, the V2 draft), kept unchanged for reference; see its README |

Each notebook has a **plain-Python mirror** (`.py`, same name) so changes show up as readable diffs on GitHub.
After editing a notebook, regenerate its mirror (a test fails otherwise):

```powershell
.venv\Scripts\python -m jupytext --to py:percent --opt notebook_metadata_filter=-all notebooks\<name>.ipynb
```

The heavy lifting (building views, training) is also available as scripts: see [scripts/README.md](../scripts/README.md).
