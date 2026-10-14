"""Encrypt / decrypt the private V3 Star Gazer artifacts (model + detailed results).

The repository is public, but the trained V3 model and its detailed results are committed only
encrypted, as secure/star_gazer_v3.partNN.enc (AES-256-GCM) plus secure/MANIFEST.json.
Headline metrics stay public in the README.

    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py keygen [--passphrase]   # once: .secrets/star_gazer.key
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py lock       # models/v3 + results/v3 -> secure/
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py unlock     # secure/ -> models/v3 + results/v3
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py verify     # check the bundle against the manifest
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py rotate     # re-encrypt with a new key
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py protect    # add a passphrase to the key file
    .venv\\Scripts\\python scripts\\tools\\secure_artifacts.py status

Format (MANIFEST "format": 2):
- The artifacts are packed as one tar.gz, cut into parts of at most PART_BYTES (GitHub rejects
  files over 100 MB; an ensemble of five models is ~190 MB).
- Each part is AES-256-GCM encrypted with its own random 96-bit nonce. Its associated data binds
  the bundle id, creation time, part number and part count, so parts can't be reordered, dropped,
  or mixed with parts of another bundle (any change fails decryption).
- MANIFEST.json lists every part's SHA-256, checked before decrypting for a clear error message.
- Extraction is limited to models/v3 and results/v3, with Python's tarfile 'data' filter.

The key is read from the STAR_GAZER_KEY environment variable if set (e.g. as a secret on an app
server), otherwise from .secrets/star_gazer.key (git-ignored, owner-only permissions). The key file
may be passphrase-protected (scrypt + AES-GCM); the passphrase comes from STAR_GAZER_PASSPHRASE
or a prompt. BACK UP THE KEY (password manager + one offline copy). Without it the bundle cannot
be opened; the only fallback is retraining with scripts/pipeline/train_star_gazer.py.
"""

import argparse
import base64
import getpass
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KEY_FILE = ROOT / '.secrets' / 'star_gazer.key'
ENV_VAR = 'STAR_GAZER_KEY'
PASS_VAR = 'STAR_GAZER_PASSPHRASE'
SECURE_DIR = ROOT / 'secure'
BUNDLE_STEM = 'star_gazer_v3'
MANIFEST = SECURE_DIR / 'MANIFEST.json'
PROTECTED = ['models/v3', 'results/v3']      # relative to repo root
MAGIC = b'SGB2'                              # part header: magic + 12-byte nonce + ciphertext
FORMAT = 2
PART_BYTES = 90_000_000                      # plaintext bytes per part (< GitHub's 100 MB limit)
SCRYPT = {'n': 2 ** 15, 'r': 8, 'p': 1}      # passphrase-wrapped key files


def _aesgcm(key):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return AESGCM(key)


# ---------------------------------------------------------------------------- key handling
def _scrypt(passphrase, salt, n, r, p):
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
    return Scrypt(salt=salt, length=32, n=n, r=r, p=p).derive(passphrase.encode('utf-8'))


def _passphrase(confirm=False):
    phrase = os.environ.get(PASS_VAR)
    if phrase:
        return phrase
    phrase = getpass.getpass('Key passphrase: ')
    if confirm and phrase != getpass.getpass('Repeat passphrase: '):
        sys.exit('Passphrases differ.')
    if not phrase:
        sys.exit('Empty passphrase.')
    return phrase


def wrap_key(key, passphrase):
    """Key file text for a passphrase-protected key (JSON)."""
    salt, nonce = os.urandom(16), os.urandom(12)
    kek = _scrypt(passphrase, salt, **SCRYPT)
    wrapped = _aesgcm(kek).encrypt(nonce, key, b'star-gazer-key')
    def b64(b):
        return base64.urlsafe_b64encode(b).decode()

    return json.dumps({'kdf': 'scrypt', **SCRYPT, 'salt': b64(salt), 'nonce': b64(nonce),
                       'wrapped': b64(wrapped)}) + '\n'


def unwrap_key(text, passphrase):
    from cryptography.exceptions import InvalidTag
    d = json.loads(text)
    kek = _scrypt(passphrase, base64.urlsafe_b64decode(d['salt']), d['n'], d['r'], d['p'])
    try:
        return _aesgcm(kek).decrypt(base64.urlsafe_b64decode(d['nonce']),
                                    base64.urlsafe_b64decode(d['wrapped']), b'star-gazer-key')
    except InvalidTag:
        sys.exit('Wrong passphrase for the key file.')


def parse_key(raw, passphrase=None):
    """32-byte key from base64 text, or from a passphrase-protected key file (JSON)."""
    raw = raw.strip()
    if raw.startswith('{'):
        key = unwrap_key(raw, passphrase if passphrase is not None else _passphrase())
    else:
        key = base64.urlsafe_b64decode(raw)
    if len(key) != 32:
        sys.exit('Invalid key: expected 32 bytes.')
    return key


def load_key():
    raw = os.environ.get(ENV_VAR) or (KEY_FILE.read_text().strip() if KEY_FILE.exists() else None)
    if not raw:
        sys.exit(f'No key found. Set {ENV_VAR} or run "keygen" (creates {KEY_FILE.relative_to(ROOT)}).')
    return parse_key(raw)


def restrict_permissions(path):
    """Owner-only access to the key file (best effort on Windows, chmod 600 elsewhere)."""
    try:
        if os.name == 'nt':
            user = os.environ.get('USERNAME')
            if user:
                subprocess.run(['icacls', str(path), '/inheritance:r', '/grant:r', f'{user}:F'],
                               check=True, capture_output=True)
        else:
            os.chmod(path, 0o600)
    except (OSError, subprocess.CalledProcessError) as e:
        print(f'Note: could not restrict permissions on {path.name} ({e}); do it manually.')


def write_key_file(key, passphrase=None, path=None):
    path = path or KEY_FILE   # looked up at call time (tests point it elsewhere)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = wrap_key(key, passphrase) if passphrase else base64.urlsafe_b64encode(key).decode() + '\n'
    path.write_text(text)
    restrict_permissions(path)


def keygen(args):
    if KEY_FILE.exists():
        sys.exit(f'{KEY_FILE.relative_to(ROOT)} already exists; refusing to overwrite it.')
    write_key_file(os.urandom(32), _passphrase(confirm=True) if args.passphrase else None)
    print(f'Created {KEY_FILE.relative_to(ROOT)} (git-ignored, owner-only).')
    print('BACK IT UP NOW (password manager + one offline copy): without it the bundle cannot be opened.')


def protect(_args):
    if not KEY_FILE.exists():
        sys.exit('No key file to protect.')
    if KEY_FILE.read_text().lstrip().startswith('{'):
        sys.exit('The key file is already passphrase-protected.')
    key = parse_key(KEY_FILE.read_text())
    write_key_file(key, _passphrase(confirm=True))
    print('Key file is now passphrase-protected. The key itself is unchanged (bundles still open).')


# ---------------------------------------------------------------------------- bundle
def _aad(bundle_id, created, index, count):
    return MAGIC + json.dumps({'format': FORMAT, 'bundle': bundle_id, 'created': created,
                               'part': index, 'parts': count}, sort_keys=True).encode()


def _pack():
    present = [p for p in PROTECTED if (ROOT / p).exists()]
    if not present:
        sys.exit(f'Nothing to lock: none of {PROTECTED} exist.')
    buf, files = io.BytesIO(), []
    with tarfile.open(fileobj=buf, mode='w:gz') as tar:
        for rel in present:
            for f in sorted((ROOT / rel).rglob('*')):
                if f.is_file():
                    arc = f.relative_to(ROOT).as_posix()
                    tar.add(f, arcname=arc)
                    files.append(arc)
    return buf.getvalue(), files, present


def encrypt_bundle(plain, key, out_dir=None, part_bytes=None):
    """Write parts + return the manifest dict (not yet saved)."""
    out_dir, part_bytes = out_dir or SECURE_DIR, part_bytes or PART_BYTES
    bundle_id = os.urandom(8).hex()
    created = datetime.now(timezone.utc).isoformat(timespec='seconds')
    chunks = [plain[i:i + part_bytes] for i in range(0, len(plain), part_bytes)] or [b'']
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(f'{BUNDLE_STEM}*.enc'):   # no stale parts from an earlier, larger bundle
        old.unlink()
    parts = []
    for i, chunk in enumerate(chunks):
        nonce = os.urandom(12)
        blob = MAGIC + nonce + _aesgcm(key).encrypt(nonce, chunk, _aad(bundle_id, created, i, len(chunks)))
        name = f'{BUNDLE_STEM}.part{i:02d}.enc'
        (out_dir / name).write_bytes(blob)
        parts.append({'file': name, 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()})
    return {'format': FORMAT, 'bundle': bundle_id, 'created_utc': created,
            'encryption': 'AES-256-GCM per part; associated data binds bundle id, time, part number and count',
            'parts': parts}


def read_manifest(secure_dir=None):
    path = (secure_dir or SECURE_DIR) / MANIFEST.name
    if not path.exists():
        sys.exit(f'{path} not found; run "lock" first.')
    m = json.loads(path.read_text())
    if m.get('format') != FORMAT:
        sys.exit(f'Unsupported bundle format {m.get("format")!r} (this script reads format {FORMAT}).')
    return m


def verify_parts(manifest, secure_dir=None):
    """Check every part exists and matches its SHA-256; returns the part bytes in order."""
    secure_dir = secure_dir or SECURE_DIR
    blobs = []
    for p in manifest['parts']:
        path = secure_dir / p['file']
        if Path(p['file']).name != p['file'] or not p['file'].startswith(BUNDLE_STEM):
            sys.exit(f'Manifest names an unexpected file: {p["file"]!r}')
        if not path.exists():
            sys.exit(f'Missing part {p["file"]} (the bundle is incomplete).')
        blob = path.read_bytes()
        if hashlib.sha256(blob).hexdigest() != p['sha256']:
            sys.exit(f'{p["file"]} does not match MANIFEST.json (corrupted, or from another bundle).')
        if blob[:4] != MAGIC:
            sys.exit(f'{p["file"]} is not a Star Gazer bundle part.')
        blobs.append(blob)
    return blobs


def decrypt_bundle(key, secure_dir=None):
    from cryptography.exceptions import InvalidTag
    m = read_manifest(secure_dir)
    blobs = verify_parts(m, secure_dir)
    out = []
    for i, blob in enumerate(blobs):
        try:
            out.append(_aesgcm(key).decrypt(blob[4:16], blob[16:], _aad(m['bundle'], m['created_utc'], i, len(blobs))))
        except InvalidTag:
            sys.exit(f'Decryption failed on part {i}: wrong key, or the parts/manifest were altered.')
    return b''.join(out), m


def lock(_args):
    key = load_key()
    plain, files, present = _pack()
    manifest = encrypt_bundle(plain, key)
    manifest.update({'n_files': len(files), 'contains': present})
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    total = sum(p['bytes'] for p in manifest['parts'])
    print(f'Locked {len(files)} files ({len(plain) / 1e6:.1f} MB compressed) -> '
          f'{len(manifest["parts"])} part(s) in {SECURE_DIR.relative_to(ROOT)} ({total / 1e6:.1f} MB)')


def _extract(plain, force):
    with tarfile.open(fileobj=io.BytesIO(plain), mode='r:gz') as tar:
        members = tar.getmembers()
        allowed = tuple(p + '/' for p in PROTECTED)
        bad = [m.name for m in members if not m.name.startswith(allowed)]
        if bad:
            sys.exit(f'Refusing to extract unexpected paths: {bad[:3]}')
        clash = [m.name for m in members if (ROOT / m.name).exists()]
        if clash and not force:
            sys.exit(f'{len(clash)} files already exist (e.g. {clash[0]}); use --force to overwrite.')
        tar.extractall(ROOT, filter='data')
    return len(members)


def unlock(args):
    plain, _ = decrypt_bundle(load_key())
    n = _extract(plain, args.force)
    print(f'Unlocked {n} files into {", ".join(PROTECTED)}')


def verify(_args):
    m = read_manifest()
    verify_parts(m)
    print(f'{len(m["parts"])} part(s) match MANIFEST.json (bundle {m["bundle"]}, {m["created_utc"]}).')
    if os.environ.get(ENV_VAR) or KEY_FILE.exists():
        plain, _ = decrypt_bundle(load_key())
        with tarfile.open(fileobj=io.BytesIO(plain), mode='r:gz') as tar:
            print(f'Decrypts with the current key: {len(tar.getmembers())} files.')


def rotate(_args):
    """Re-encrypt the bundle with a fresh key; the old key file is kept until you delete it."""
    if os.environ.get(ENV_VAR):
        sys.exit(f'Unset {ENV_VAR} first: rotate works on the key file.')
    old_key = load_key()
    plain, m = decrypt_bundle(old_key)
    new_key = os.urandom(32)
    protected = KEY_FILE.read_text().lstrip().startswith('{')
    manifest = encrypt_bundle(plain, new_key)
    manifest.update({k: m[k] for k in ('n_files', 'contains') if k in m})
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    old_copy = KEY_FILE.with_name(f'{KEY_FILE.name}.old-{stamp}')
    KEY_FILE.replace(old_copy)
    write_key_file(new_key, _passphrase(confirm=True) if protected else None)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + '\n')
    decrypt_bundle(load_key())   # prove the new key opens the new bundle before finishing
    print(f'Rotated: new key in {KEY_FILE.relative_to(ROOT)}, bundle re-encrypted and verified.')
    print(f'Old key kept as {old_copy.relative_to(ROOT)}; delete it once the new key is backed up.')
    print('Update STAR_GAZER_KEY anywhere it is set (e.g. the Hugging Face Space secret).')


def status(_args):
    has_key = bool(os.environ.get(ENV_VAR)) or KEY_FILE.exists()
    protected = KEY_FILE.exists() and KEY_FILE.read_text().lstrip().startswith('{')
    print(f'key available : {has_key}{" (passphrase-protected)" if protected else ""}')
    if MANIFEST.exists():
        m = json.loads(MANIFEST.read_text())
        print(f'bundle        : {len(m.get("parts", []))} part(s), created {m.get("created_utc")}')
    else:
        print('bundle        : missing')
    for p in PROTECTED:
        print(f'{p:14s}: {"present" if (ROOT / p).exists() else "missing"}')


def main():
    parser = argparse.ArgumentParser(description='Encrypt / decrypt V3 Star Gazer artifacts.')
    sub = parser.add_subparsers(dest='cmd', required=True)
    k = sub.add_parser('keygen')
    k.add_argument('--passphrase', action='store_true', help='protect the key file with a passphrase')
    k.set_defaults(fn=keygen)
    sub.add_parser('lock').set_defaults(fn=lock)
    u = sub.add_parser('unlock')
    u.add_argument('--force', action='store_true')
    u.set_defaults(fn=unlock)
    sub.add_parser('verify').set_defaults(fn=verify)
    sub.add_parser('rotate').set_defaults(fn=rotate)
    sub.add_parser('protect').set_defaults(fn=protect)
    sub.add_parser('status').set_defaults(fn=status)
    args = parser.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
