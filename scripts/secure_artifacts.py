"""Encrypt / decrypt the private V3 Star Gazer artifacts (model + detailed results).

The repository is public, but the trained V3 model and its detailed results are
committed only as one encrypted file, secure/star_gazer_v3.enc (AES-256-GCM).
Headline metrics stay public in the README.

    .venv\\Scripts\\python scripts\\secure_artifacts.py keygen     # once: creates .secrets/star_gazer.key
    .venv\\Scripts\\python scripts\\secure_artifacts.py lock       # models/v3 + results/v3 -> secure/*.enc
    .venv\\Scripts\\python scripts\\secure_artifacts.py unlock     # secure/*.enc -> models/v3 + results/v3
    .venv\\Scripts\\python scripts\\secure_artifacts.py status

The key is read from the STAR_GAZER_KEY environment variable if set (e.g. as a
secret on an app server), otherwise from .secrets/star_gazer.key (git-ignored).
BACK UP THE KEY (password manager). Without it the encrypted file cannot be opened;
the only fallback is retraining with scripts/train_star_gazer.py.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY_FILE = ROOT / '.secrets' / 'star_gazer.key'
ENV_VAR = 'STAR_GAZER_KEY'
BUNDLE = ROOT / 'secure' / 'star_gazer_v3.enc'
MANIFEST = ROOT / 'secure' / 'MANIFEST.json'
PROTECTED = ['models/v3', 'results/v3']      # relative to repo root
MAGIC = b'SGV3'                              # file header: magic + 12-byte nonce + ciphertext


def _aesgcm(key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(key)


def load_key():
    raw = os.environ.get(ENV_VAR) or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else None)
    if not raw:
        sys.exit(f'No key found. Set {ENV_VAR} or run "keygen" (creates {KEY_FILE.relative_to(ROOT)}).')
    key = base64.urlsafe_b64decode(raw)
    if len(key) != 32:
        sys.exit('Invalid key: expected 32 bytes (base64).')
    return key


def keygen(_args):
    if KEY_FILE.exists():
        sys.exit(f'{KEY_FILE.relative_to(ROOT)} already exists; refusing to overwrite it.')
    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_text(base64.urlsafe_b64encode(os.urandom(32)).decode() + '\n')
    print(f'Created {KEY_FILE.relative_to(ROOT)} (git-ignored).')
    print('Back it up now (e.g. a password manager): without it the encrypted artifacts cannot be opened.')


def lock(_args):
    key = load_key()
    present = [p for p in PROTECTED if (ROOT / p).exists()]
    if not present:
        sys.exit(f'Nothing to lock: none of {PROTECTED} exist.')
    buf = io.BytesIO()
    files = []
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for rel in present:
            for f in sorted((ROOT / rel).rglob('*')):
                if f.is_file():
                    arc = f.relative_to(ROOT).as_posix()
                    tar.add(f, arcname=arc)
                    files.append(arc)
    plain = buf.getvalue()
    nonce = os.urandom(12)
    blob = MAGIC + nonce + _aesgcm(key).encrypt(nonce, plain, MAGIC)
    BUNDLE.parent.mkdir(parents=True, exist_ok=True)
    BUNDLE.write_bytes(blob)
    MANIFEST.write_text(json.dumps({
        'bundle': BUNDLE.name,
        'created_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'encryption': 'AES-256-GCM',
        'sha256_encrypted': hashlib.sha256(blob).hexdigest(),
        'n_files': len(files),
        'contains': present,
    }, indent=2) + '\n')
    print(f'Locked {len(files)} files ({len(plain) / 1e6:.1f} MB compressed) -> '
          f'{BUNDLE.relative_to(ROOT)} ({len(blob) / 1e6:.1f} MB)')
    if len(blob) > 95e6:
        print('WARNING: over ~95 MB; GitHub rejects files larger than 100 MB.')


def unlock(args):
    key = load_key()
    if not BUNDLE.exists():
        sys.exit(f'{BUNDLE.relative_to(ROOT)} not found.')
    blob = BUNDLE.read_bytes()
    if blob[:4] != MAGIC:
        sys.exit('Not a Star Gazer bundle.')
    from cryptography.exceptions import InvalidTag
    try:
        plain = _aesgcm(key).decrypt(blob[4:16], blob[16:], MAGIC)
    except InvalidTag:
        sys.exit('Decryption failed: wrong key or corrupted file.')
    with tarfile.open(fileobj=io.BytesIO(plain), mode='r:gz') as tar:
        members = tar.getmembers()
        allowed = tuple(p + '/' for p in PROTECTED)
        bad = [m.name for m in members if not m.name.startswith(allowed)]
        if bad:
            sys.exit(f'Refusing to extract unexpected paths: {bad[:3]}')
        clash = [m.name for m in members if (ROOT / m.name).exists()]
        if clash and not args.force:
            sys.exit(f'{len(clash)} files already exist (e.g. {clash[0]}); use --force to overwrite.')
        tar.extractall(ROOT, filter='data')
    print(f'Unlocked {len(members)} files into {", ".join(PROTECTED)}')


def status(_args):
    has_key = bool(os.environ.get(ENV_VAR)) or KEY_FILE.exists()
    print(f'key available : {has_key}')
    print(f'bundle        : {BUNDLE.relative_to(ROOT)} ({"present" if BUNDLE.exists() else "missing"})')
    for p in PROTECTED:
        print(f'{p:14s}: {"present" if (ROOT / p).exists() else "missing"}')


def main():
    parser = argparse.ArgumentParser(description='Encrypt / decrypt V3 Star Gazer artifacts.')
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('keygen').set_defaults(fn=keygen)
    sub.add_parser('lock').set_defaults(fn=lock)
    u = sub.add_parser('unlock')
    u.add_argument('--force', action='store_true')
    u.set_defaults(fn=unlock)
    sub.add_parser('status').set_defaults(fn=status)
    args = parser.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
