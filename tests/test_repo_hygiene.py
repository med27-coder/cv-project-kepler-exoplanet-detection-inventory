"""The last line of defence for secrets: CI fails if the repository ever tracks one.

The Star Gazer key (.secrets/star_gazer.key) and any other *.key, *.pem or .env file must never be committed. Local
guards stop it first (.gitignore, the Claude Code hook .claude/hooks/guard_secrets.py, and the git pre-commit hook
.claude/hooks/precommit_secrets.py), but those can be skipped on someone's machine; this check runs on GitHub.
"""
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SECRET = re.compile(r'(^|/)(\.secrets(/|$)|[^/]*\.(key|pem)$|\.env(\.[\w-]+)?$)', re.IGNORECASE)


def tracked_files():
    out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=False)
    if out.returncode != 0:
        pytest.skip('not a git checkout')
    return [p for p in out.stdout.decode('utf-8', 'replace').split('\0') if p]


def test_no_secret_files_are_tracked():
    bad = [p for p in tracked_files() if SECRET.search(p)]
    assert not bad, f'secret files are tracked by git: {bad}'


def test_secrets_folder_is_ignored():
    out = subprocess.run(['git', 'check-ignore', '-q', '.secrets/star_gazer.key'], cwd=ROOT, check=False)
    assert out.returncode == 0, '.secrets/ must stay in .gitignore'
