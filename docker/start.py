"""Container entry point for Star Gazer: decrypt the model if a key was given, then start Streamlit.

Environment variables (set with `docker run -e`, compose.yaml, or the cloud service's settings):
    STAR_GAZER_KEY       secret: the key that decrypts secure/*.enc into models/v3 (never baked into the image)
    KEPLER_ACCEPT_TERMS  1 = the operator accepts the Terms of Use (visitors still tick the box in the app)
    PORT                 port to listen on (default 8501; Cloud Run, App Runner and others set it themselves)
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / 'models' / 'v3' / 'star_gazer.keras'
PORT = os.environ.get('PORT', '8501')

if not MODEL.exists():
    if os.environ.get('STAR_GAZER_KEY'):
        print('Decrypting the Star Gazer model...', flush=True)
        subprocess.run([sys.executable, str(ROOT / 'scripts' / 'tools' / 'secure_artifacts.py'), 'unlock'],
                       check=True)
    else:
        print('WARNING: STAR_GAZER_KEY is not set, so there is no model to serve. '
              'The page will load and explain this.', flush=True)

# exec replaces this process with Streamlit, so Streamlit receives the container's stop signal directly
os.execv(sys.executable, [sys.executable, '-m', 'streamlit', 'run', str(ROOT / 'app.py'),
                          '--server.address', '0.0.0.0', '--server.port', PORT,
                          '--', '--model', 'v3'])