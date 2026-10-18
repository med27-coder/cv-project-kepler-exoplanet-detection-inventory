"""PostToolUse hook (Edit|Write): after a change in web/src/*.js, rebuild web/starmap.js and check its syntax.

A syntax error there blanks the whole site (it happened with an unescaped apostrophe in v1.9.0), so a failure is
sent straight back to Claude as a blocking message to fix before anything else.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PY = ROOT / '.venv' / 'Scripts' / 'python.exe'


def main():
    data = json.load(sys.stdin)
    path = (data.get('tool_input') or {}).get('file_path', '') or (data.get('tool_response') or {}).get('filePath', '')
    if not re.search(r'[/\\]web[/\\]src[/\\][^/\\]+\.js$', path):
        return
    build = subprocess.run([str(PY if PY.exists() else 'python'), str(ROOT / 'scripts/starmap/build_web.py')],
                           capture_output=True, text=True, cwd=ROOT)
    check = subprocess.run(['node', '--check', str(ROOT / 'web/starmap.js')], capture_output=True, text=True, cwd=ROOT) \
        if build.returncode == 0 else build
    if check.returncode != 0:
        print(json.dumps({'decision': 'block',
                          'reason': 'web/starmap.js is broken after this edit (check_web.py hook):\n'
                                    + (check.stderr or check.stdout)[-1500:]}))


if __name__ == '__main__':
    main()
