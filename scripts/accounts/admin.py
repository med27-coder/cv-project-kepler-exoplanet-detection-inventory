"""Admin commands for the star map's player accounts (docs/plans/ACCOUNTS_AND_ACCESS.md).

    .venv\\Scripts\\python scripts\\accounts\\admin.py create-admin --name MED27-CODER

create-admin  makes the owner's admin account: a pilot name, a long random password and the admin role (at most
              one admin). The password is written to .secrets/<name>.admin.txt (git-ignored, refused by the commit
              hooks) and never printed; move it to a password manager.

Talks to the local Supabase (`npx supabase@2.122.1 start`); its URL and service key come from `supabase status`,
or from SUPABASE_URL and SUPABASE_SECRET_KEY when set. More commands (list, role, disable, reset-password, ...)
follow the plan's admin table.
"""

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SECRETS = ROOT / '.secrets'
PILOT = re.compile(r'^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$')   # the same rule as the database
CLI = ['npx.cmd' if os.name == 'nt' else 'npx', '--yes', 'supabase@2.122.1']


def connection() -> tuple[str, str]:
    """(API URL, service key) of the Supabase to manage."""
    if os.environ.get('SUPABASE_URL') and os.environ.get('SUPABASE_SECRET_KEY'):
        return os.environ['SUPABASE_URL'].rstrip('/'), os.environ['SUPABASE_SECRET_KEY']
    out = subprocess.run([*CLI, 'status', '-o', 'json', '--workdir', str(ROOT)],
                         capture_output=True, text=True, check=False)
    start = out.stdout.find('{')
    if out.returncode or start < 0:
        sys.exit('The local Supabase is not running: start it with `npx supabase@2.122.1 start` (Docker Desktop on).')
    status = json.loads(out.stdout[start:])
    return status['API_URL'], status['SERVICE_ROLE_KEY']


def call(url: str, key: str, path: str, body: dict) -> dict:
    """POST JSON as the service role; the response as a dict (empty for no content)."""
    req = urllib.request.Request(f'{url}{path}', data=json.dumps(body).encode(), method='POST',
                                 headers={'apikey': key, 'Authorization': f'Bearer {key}',
                                          'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:   # the URL is our own Supabase, from status or env
            text = r.read().decode()
    except urllib.error.HTTPError as e:
        detail = e.read().decode()
        try:
            detail = json.loads(detail).get('msg') or json.loads(detail).get('message') or detail
        except ValueError:
            pass
        sys.exit(f'Refused ({e.code}): {detail}')
    return json.loads(text) if text.strip() else {}


def create_admin(name: str) -> None:
    name = name.upper()
    if not PILOT.match(name):
        sys.exit('Pilot names are 3 to 20 letters, digits or dashes.')
    out = SECRETS / f'{name.lower()}.admin.txt'
    if out.exists():
        sys.exit(f'{out.relative_to(ROOT)} already exists: that admin was made already.')
    url, key = connection()
    password = secrets.token_urlsafe(24)   # 32 characters
    call(url, key, '/auth/v1/admin/users', {'email': f'{name.lower()}@pilots.invalid', 'password': password,
                                            'email_confirm': True, 'user_metadata': {'pilot_name': name}})
    call(url, key, '/rest/v1/rpc/admin_set_role', {'pilot': name, 'new_role': 'admin'})
    SECRETS.mkdir(exist_ok=True)
    out.write_text(f'Kepler Star Map admin ({url})\npilot name: {name}\npassword: {password}\n', encoding='utf-8')
    if os.name != 'nt':
        out.chmod(0o600)
    print(f'Admin {name} created. Its password is in {out.relative_to(ROOT)}: move it to a password manager.')


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('create-admin', help="make the owner's admin account")
    p.add_argument('--name', required=True, help='pilot name, 3 to 20 letters, digits or dashes')
    args = parser.parse_args(argv)
    if args.command == 'create-admin':
        create_admin(args.name)


if __name__ == '__main__':
    main()
