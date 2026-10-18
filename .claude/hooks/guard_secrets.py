"""PreToolUse hook (Bash): never let a git command add or commit the Star Gazer key or other secrets.

Blocks a git add/commit whose command names .secrets/, a *.key, *.pem or .env file, and any git commit while such
a file is staged. The key (.secrets/star_gazer.key) is git-ignored already; this is the second lock on the door.
"""
import json
import re
import subprocess
import sys

SECRET = re.compile(r'''(^|[\s/\\"'])(\.secrets([/\\]|\s|$)|[^\s"']*\.(key|pem)\b|\.env(\.\w+)?\b)''')


def deny(reason):
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                                             'permissionDecisionReason': reason}}))
    sys.exit(0)


def main():
    cmd = (json.load(sys.stdin).get('tool_input') or {}).get('command', '')
    if not re.search(r'\bgit\b[^|;&]*\b(add|commit|stash)\b', cmd):
        return
    # Only the paths a `git add` names count (a commit message may well talk about the key without staging it).
    for paths in re.findall(r'\bgit\s+add\b([^|;&\n]*)', cmd):
        if SECRET.search(paths):
            deny('Blocked by .claude/hooks/guard_secrets.py: this git add names a secret (.secrets/, *.key, *.pem '
                 'or .env). The Star Gazer key must never be committed.')
    if re.search(r'\bgit\b[^|;&]*\bcommit\b', cmd):
        staged = subprocess.run(['git', 'diff', '--cached', '--name-only'], capture_output=True, text=True, check=False).stdout
        bad = [f for f in staged.splitlines() if SECRET.search(' ' + f)]
        if bad:
            deny(f'Blocked by .claude/hooks/guard_secrets.py: secret files are staged ({", ".join(bad)}). '
                 'Unstage them with git restore --staged before committing.')


if __name__ == '__main__':
    main()
