"""Assemble a Hugging Face Space (free CPU tier) that serves the Star Gazer web app.

    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py lock      # make sure the bundle is current
    .venv\\Scripts\\python scripts\\tools\\make_hf_space.py              # -> build/hf_space/

Then, with a free Hugging Face account (https://huggingface.co/join):
    .venv\\Scripts\\pip install huggingface_hub
    .venv\\Scripts\\hf auth login
    .venv\\Scripts\\hf repo create star-gazer --repo-type space --space_sdk docker
    .venv\\Scripts\\hf upload <your-username>/star-gazer build\\hf_space . --repo-type space
In the Space's Settings > Variables and secrets add:
    secret   STAR_GAZER_KEY = <contents of .secrets/star_gazer.key>
    variable KEPLER_ACCEPT_TERMS = 1    (you, the operator, accept the Terms; visitors still tick the box)

The trained model is uploaded only encrypted (secure/*.enc + MANIFEST.json) and decrypted
inside the Space at start-up with the secret key; the key itself is never uploaded.

The app is Streamlit (app.py), which Hugging Face runs as a Docker Space: the Dockerfile written here installs
the requirements and starts space_app.py, which decrypts the model and then runs `streamlit run app.py`.
"""

import shutil
import subprocess
import sys
from pathlib import Path

from kepler_cnn import star_gazer as S

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'build' / 'hf_space'

SPACE_README = """---
title: Star Gazer
emoji: 🔭
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: other
short_description: Kepler exoplanet vetting with a multi-view CNN
---

# 🔭 Star Gazer

Enter a Kepler Object of Interest (e.g. `K00010.01`). The app downloads all of the
star's Kepler light curves from NASA MAST, builds AstroNet / ExoMiner-style views and
asks the V3 Star Gazer model whether the transit looks like a real planet. Tick
"Explain this prediction" for a saliency map.

Educational project, not a scientific classification. See the Terms of Use in the app.
Source: https://github.com/med27-coder/cv-project-kepler-exoplanet-detection-inventory
"""

SPACE_APP = '''"""Hugging Face Space entry point: decrypt the model, fetch the catalog, start the app."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# The Space installs only requirements.txt, not this package: src/ is on PYTHONPATH (the Dockerfile sets it).
# The import below must wait until the model is decrypted, hence the noqa: E402 marker.

if not (ROOT / 'models' / 'v3' / 'star_gazer.keras').exists():
    if not os.environ.get('STAR_GAZER_KEY'):
        sys.exit('Set the STAR_GAZER_KEY secret in the Space settings.')
    subprocess.run([sys.executable, str(ROOT / 'scripts' / 'secure_artifacts.py'), 'unlock'], check=True)

from kepler_cnn import star_gazer as S  # noqa: E402

S.load_catalog()   # downloads the KOI table on first start
os.execv(sys.executable, [sys.executable, '-m', 'streamlit', 'run', str(ROOT / 'app.py'),
                          '--server.address', '0.0.0.0', '--server.port', '7860', '--', '--model', 'v3'])
'''

DOCKERFILE = """FROM python:3.12-slim
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONPATH=/home/user/app/src
WORKDIR /home/user/app
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=user . .
EXPOSE 7860
CMD ["python", "space_app.py"]
"""

SPACE_REQUIREMENTS = """numpy>=1.26
pandas>=2.3.3
lightkurve>=2.6.0
astropy>=5.3.3
tensorflow-cpu>=2.16
scikit-learn>=1.5.0
matplotlib>=3.7
seaborn>=0.13.2
tqdm>=4.66.3
cryptography>=50.0.2
streamlit>=1.66.1
pillow>=13.0.0
"""


def check_bundle(bundle):
    """Refuse to ship a model the Space would reject at start-up (StaleModelError) or a bundle
    older than the local model. The bundle is encrypted, so the local copy is what's checked."""
    files = S.model_files()
    if not files:
        sys.exit(f'No local model in {S.MODEL_DIR}; cannot verify the bundle. Train, then lock.')
    try:
        S.check_view_version()
    except S.StaleModelError as e:
        sys.exit(f'{e}\nThe Space would crash on start-up with this model.')
    newest = max(p.stat().st_mtime for p in [*files, S.THRESHOLD_FILE] if p.exists())
    if bundle.stat().st_mtime < newest:
        sys.exit('The encrypted bundle (secure/MANIFEST.json) is older than the model in models/v3; '
                 'run scripts/tools/secure_artifacts.py lock again.')


def main():
    bundle = ROOT / 'secure' / 'MANIFEST.json'   # written last by lock, so its time is the bundle's
    if not bundle.exists():
        sys.exit('secure/MANIFEST.json not found; run scripts/tools/secure_artifacts.py lock first.')
    subprocess.run([sys.executable, str(ROOT / 'scripts' / 'tools' / 'secure_artifacts.py'), 'verify'], check=True)
    check_bundle(bundle)
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'scripts').mkdir(parents=True)
    shutil.copytree(ROOT / 'src' / 'kepler_cnn', OUT / 'src' / 'kepler_cnn',
                    ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copytree(ROOT / 'secure', OUT / 'secure')
    for f in ('app.py', 'TERMS_OF_USE.md', 'pyproject.toml', '.streamlit/config.toml'):
        (OUT / f).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / f, OUT / f)
    shutil.copy2(ROOT / 'scripts' / 'tools' / 'secure_artifacts.py', OUT / 'scripts' / 'secure_artifacts.py')   # flat in the Space
    (OUT / 'README.md').write_text(SPACE_README, encoding='utf-8')
    (OUT / 'space_app.py').write_text(SPACE_APP, encoding='utf-8')
    (OUT / 'requirements.txt').write_text(SPACE_REQUIREMENTS, encoding='utf-8')
    (OUT / 'Dockerfile').write_text(DOCKERFILE, encoding='utf-8')
    n = sum(1 for p in OUT.rglob('*') if p.is_file())
    print(f'Built {OUT.relative_to(ROOT)} ({n} files). Upload instructions: see this script\'s docstring.')


if __name__ == '__main__':
    main()
