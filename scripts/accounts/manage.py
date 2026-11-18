"""The owner's commands for the star map's player accounts (docs/plans/ACCOUNTS_AND_ACCESS.md).

    .venv\\Scripts\\python scripts\\accounts\\manage.py create-tester --name MED27-CODER
    .venv\\Scripts\\python scripts\\accounts\\manage.py role MED27-CODER player
    .venv\\Scripts\\python scripts\\accounts\\manage.py backup
    .venv\\Scripts\\python scripts\\accounts\\manage.py restore .secrets\\db-backups\\kepler-20261117-1950.sql --yes

create-tester makes a tester account (the owner's own, for one): a pilot name, a long random password and the
              tester role. The password is written to .secrets/<name>.tester.txt (git-ignored, refused by the
              commit hooks) and never printed; move it to a password manager.
role          makes a pilot a player or a tester (logged in the audit log).
backup        saves every account and its progress to .secrets/db-backups/kepler-<date>-<time>.sql (it holds the
              scrambled passwords, so it lives with the other secrets). Sign-in sessions and logs are left out.
restore       rebuilds the database from the migrations and loads a backup into it. It replaces everything, so it
              needs --yes, and it saves a backup of the current state first. Everyone signs in again afterwards.

The database files live in a Docker volume, so closing Docker or `supabase stop` keeps them; `supabase db reset`
and `supabase stop --no-backup` erase them (take a backup first).

Talks to the local Supabase (`npx supabase@2.122.1 start`); its URL and service key come from `supabase status`,
or from SUPABASE_URL and SUPABASE_SECRET_KEY when set. More commands (list, disable, reset-password, ...)
follow the plan's table of the owner's tools.
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
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SECRETS = ROOT / '.secrets'
BACKUPS = SECRETS / 'db-backups'
DB_CONTAINER = 'supabase_db_kepler-star-map'   # project_id in supabase/config.toml
# Left out of backups: sessions, tokens and logs, which only matter while someone is signed in.
NOT_BACKED_UP = ['auth.sessions', 'auth.refresh_tokens', 'auth.mfa_amr_claims', 'auth.audit_log_entries',
                 'auth.flow_state', 'auth.one_time_tokens', 'auth.mfa_challenges']
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


def create_tester(name: str) -> None:
    name = name.upper()
    if not PILOT.match(name):
        sys.exit('Pilot names are 3 to 20 letters, digits or dashes.')
    out = SECRETS / f'{name.lower()}.tester.txt'
    if out.exists():
        sys.exit(f'{out.relative_to(ROOT)} already exists: that tester was made already.')
    url, key = connection()
    password = secrets.token_urlsafe(24)   # 32 characters
    call(url, key, '/auth/v1/admin/users', {'email': f'{name.lower()}@pilots.invalid', 'password': password,
                                            'email_confirm': True, 'user_metadata': {'pilot_name': name}})
    call(url, key, '/rest/v1/rpc/set_role', {'pilot': name, 'new_role': 'tester'})
    SECRETS.mkdir(exist_ok=True)
    out.write_text(f'Kepler Star Map tester account ({url})\npilot name: {name}\npassword: {password}\n', encoding='utf-8')
    if os.name != 'nt':
        out.chmod(0o600)
    print(f'Tester {name} created. Its password is in {out.relative_to(ROOT)}: move it to a password manager.')


def supabase(*args: str) -> None:
    """Run a Supabase CLI command on this project; stop with its message if it fails."""
    out = subprocess.run([*CLI, *args, '--workdir', str(ROOT)], capture_output=True, text=True, check=False)
    if out.returncode:
        sys.exit(f'supabase {args[0]} failed: {(out.stderr or out.stdout).strip()[-500:]}')


def backup(label: str = '') -> Path:
    connection()   # stops with a clear message if the local Supabase isn't running
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
    out = BACKUPS / f'kepler-{stamp}{"-" + label if label else ""}.sql'
    supabase('db', 'dump', '--local', '--data-only', '--schema', 'public,auth', '--exclude', ','.join(NOT_BACKED_UP),
             '-f', str(out))
    text = out.read_text(encoding='utf-8')
    if 'session_replication_role = replica' not in text or '"public"."profiles"' not in text:
        sys.exit(f'{out.relative_to(ROOT)} does not look like a full backup; check it before relying on it.')
    accounts = psql('select count(*) from public.profiles').stdout.strip()
    print(f'Backup saved: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB, {accounts} accounts).')
    return out


def psql(sql: str | None = None, script: str | None = None) -> subprocess.CompletedProcess:
    """Run SQL in the local database as Supabase's superuser (needed to load a backup with its checks off)."""
    cmd = ['docker', 'exec', '-i', DB_CONTAINER, 'psql', '-U', 'supabase_admin', '-d', 'postgres', '-q', '-tA',
           '-v', 'ON_ERROR_STOP=1']
    cmd += ['-c', sql] if sql else ['--single-transaction', '-f', '-']
    return subprocess.run(cmd, input=script, capture_output=True, text=True, check=False)


def restore(path: Path, yes: bool) -> None:
    path = path.resolve()
    if not path.is_file():
        sys.exit(f'No backup at {path}.')
    text = path.read_text(encoding='utf-8')
    if 'session_replication_role = replica' not in text or '"public"."profiles"' not in text:
        sys.exit(f'{path.name} is not a backup made by this script.')
    if not yes:
        sys.exit('restore replaces every account and all progress with the backup. Run it again with --yes.')
    safety = backup('before-restore')
    supabase('db', 'reset', '--local')   # an empty database built from supabase/migrations
    # The migrations' default limits row would clash with the backup's own.
    out = psql(script='delete from public.limits;\n' + text)
    if out.returncode:
        sys.exit(f'Restore failed, nothing loaded ({out.stderr.strip()[-500:]}). '
                 f'The state before it is in {safety.relative_to(ROOT)}: restore that to go back.')
    print(f'Restored {path.name}. The state before it is in {safety.relative_to(ROOT)}.')


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('create-tester', help='make a tester account')
    p.add_argument('--name', required=True, help='pilot name, 3 to 20 letters, digits or dashes')
    p = sub.add_parser('role', help="change a pilot's role")
    p.add_argument('name')
    p.add_argument('new_role', choices=['player', 'tester'])
    sub.add_parser('backup', help='save every account and its progress to .secrets/db-backups/')
    p = sub.add_parser('restore', help='replace the database with a backup (needs --yes)')
    p.add_argument('file', type=Path)
    p.add_argument('--yes', action='store_true', help='yes, replace everything with the backup')
    args = parser.parse_args(argv)
    if args.command == 'create-tester':
        create_tester(args.name)
    elif args.command == 'role':
        url, key = connection()
        call(url, key, '/rest/v1/rpc/set_role', {'pilot': args.name, 'new_role': args.new_role})
        print(f'{args.name.upper()} is now a {args.new_role} (from its next sign-in).')
    elif args.command == 'backup':
        backup()
    elif args.command == 'restore':
        restore(args.file, args.yes)


if __name__ == '__main__':
    main()
