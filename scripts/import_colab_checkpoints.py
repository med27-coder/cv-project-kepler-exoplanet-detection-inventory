"""Copy files saved by the Colab notebooks (Drive folder `exoplanet_checkpoints`)
into the project layout, so nothing has to be downloaded again.

    .venv\\Scripts\\python scripts\\import_colab_checkpoints.py "C:\\path\\to\\exoplanet_checkpoints"
    .venv\\Scripts\\python scripts\\import_colab_checkpoints.py <folder> --dry-run

Recognised top-level files (anything else is listed and left alone):
    X_raw.npy, y_raw.npy            -> data/processed/v2/    (Colab "V3" run; duplicates removed)
    X_lightcurves.npy, y_labels.npy -> data/processed/v1_5/  (V1.5 run)
    exoplanet_cnn_model.keras       -> models/v1_5/          (model trained by V1.5)
    nasa_koi_catalog.csv            -> data/raw/
    *.png                           -> results/colab_import/
Existing files are never overwritten unless --overwrite is given.
"""

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from kepler_cnn import config as C
from kepler_cnn import data

PROCESSED = C.PROCESSED_DIR
COPY_TO = {
    'nasa_koi_catalog.csv': C.CATALOG_FILE,
    'x_lightcurves.npy': PROCESSED / 'v1_5' / 'X_lightcurves.npy',
    'y_labels.npy': PROCESSED / 'v1_5' / 'y_labels.npy',
    'exoplanet_cnn_model.keras': C.MODELS_DIR / 'v1_5' / 'exoplanet_cnn_model.keras',
}
V2_X, V2_Y = PROCESSED / 'v2' / 'X_lightcurves.npy', PROCESSED / 'v2' / 'y_labels.npy'
PNG_DIR = C.PROJECT_ROOT / 'results' / 'colab_import'


def import_v2(source, args):
    """X_raw / y_raw from the Colab "V3" run: dedupe, cast, save as the v2 dataset."""
    if V2_X.exists() and not args.overwrite:
        print(f'  exists    {C.rel(V2_X)} (use --overwrite)')
        return 0
    X = np.load(source / 'X_raw.npy', allow_pickle=False).astype(np.float64)
    y = np.load(source / 'y_raw.npy', allow_pickle=False).astype(np.int64)
    n_before = len(X)
    X, y, _ = data.dedupe(X, y)
    print(f'  convert   X_raw.npy + y_raw.npy -> {C.rel(V2_X.parent)}  '
          f'({n_before} rows -> {len(X)} unique: {int(y.sum())} planets, {int((y == 0).sum())} false positives)')
    if not args.dry_run:
        V2_X.parent.mkdir(parents=True, exist_ok=True)
        np.save(V2_X, X)
        np.save(V2_Y, y)
    return 1


def main():
    parser = argparse.ArgumentParser(description='Import Colab/Drive checkpoint files.')
    parser.add_argument('source', type=Path, help='folder with the downloaded Colab files')
    parser.add_argument('--overwrite', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not args.source.is_dir():
        sys.exit(f'Not a folder: {args.source}')

    copied = skipped = 0
    # Top level only: subfolders on Drive hold older experiments (.h5 models, etc.)
    for src in sorted(p for p in args.source.iterdir() if p.is_file()):
        name = src.name.lower()
        if name in ('x_raw.npy', 'y_raw.npy'):
            continue  # handled by import_v2
        dst = COPY_TO.get(name)
        if dst is None and src.suffix.lower() == '.png':
            dst = PNG_DIR / src.name
        if dst is None:
            print(f'  ignored   {src.name}')
            continue
        if dst.exists() and not args.overwrite:
            print(f'  exists    {C.rel(dst)} (use --overwrite)')
            skipped += 1
            continue
        print(f'  copy      {src.name} -> {C.rel(dst)}')
        if not args.dry_run:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        copied += 1

    if (args.source / 'X_raw.npy').exists() and (args.source / 'y_raw.npy').exists():
        copied += import_v2(args.source, args)

    print(f'\n{copied} imported, {skipped} skipped' + (' (dry run)' if args.dry_run else ''))


if __name__ == '__main__':
    main()
