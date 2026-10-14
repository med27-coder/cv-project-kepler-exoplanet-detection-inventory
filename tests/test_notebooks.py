"""The notebooks' plain-Python mirrors (notebooks/*.py, readable diffs) must match the notebooks.

Regenerate after editing a notebook:
    python -m jupytext --to py:percent --opt notebook_metadata_filter=-all notebooks/<name>.ipynb
"""

from pathlib import Path

import pytest

jupytext = pytest.importorskip('jupytext')
NOTEBOOKS = sorted((Path(__file__).resolve().parents[1] / 'notebooks').glob('*.ipynb'))


@pytest.mark.parametrize('nb', NOTEBOOKS, ids=lambda p: p.name)
def test_mirror_is_up_to_date(nb):
    mirror = nb.with_suffix('.py')
    assert mirror.exists(), f'missing {mirror.name}'
    expected = jupytext.writes(jupytext.read(nb), fmt='py:percent',
                               config=jupytext.config.JupytextConfiguration(notebook_metadata_filter='-all'))
    assert mirror.read_text(encoding='utf-8').strip() == expected.strip(), f'regenerate {mirror.name}'
