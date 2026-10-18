"""PreToolUse hook (Bash, every command): never let a git command add or commit the Star Gazer key or other secrets.

Blocks a git add / stage / update-index (or a git commit given paths) that names .secrets/, a *.key, *.pem or .env
file, git's own global options (-C, -c, --git-dir...) included, and any git commit while such a file is staged. It
reads command text, so it is one layer of three: .gitignore keeps the key out of `git add .`, and the git pre-commit
hook (precommit_secrets.py, installed into .git/hooks) checks the real index on every commit however it was made.
"""
import json
import re
import subprocess
import sys

SECRET = re.compile(r'''(^|[\s/\\"'=])(\.secrets([/\\]|\s|$)|[^\s"']*\.(key|pem)\b|\.env(\.\w+)?\b)''')
GIT = r'\bgit(?:\s+(?:-C|-c|--git-dir|--work-tree|--namespace)\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+'
QUOTED = re.compile(r'''"(?:\\.|[^"\\])*"|'[^']*'|<<-?\s*'?(\w+)'?.*?^\1$''', re.DOTALL | re.MULTILINE)


def deny(reason):
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                                             'permissionDecisionReason': 'Blocked by .claude/hooks/guard_secrets.py: '
                                             + reason}}))
    sys.exit(0)


def main():
    cmd = (json.load(sys.stdin).get('tool_input') or {}).get('command', '')
    if not re.search(r'\bgit\b', cmd):
        return
    for args in re.findall(GIT + r'(?:add|stage|update-index)\b([^|;&\n]*)', cmd):
        if SECRET.search(args):
            deny('this git command stages a secret (.secrets/, *.key, *.pem or .env). The Star Gazer key must never '
                 'be committed.')
    if re.search(GIT + r'commit\b', cmd):
        bare = QUOTED.sub(' ', cmd)   # a commit message may talk about the key without committing it
        for args in re.findall(GIT + r'commit\b([^|;&\n]*)', bare):
            if SECRET.search(args):
                deny('this git commit names a secret file.')
        out = subprocess.run(['git', 'diff', '--cached', '--name-only'], capture_output=True, text=True, check=False)
        if out.returncode != 0:
            return   # not in a repository here: the git pre-commit hook still guards the real commit
        bad = [f for f in out.stdout.splitlines() if SECRET.search(' ' + f)]
        if bad:
            deny(f'secret files are staged ({", ".join(bad)}). Unstage them with git restore --staged.')


if __name__ == '__main__':
    main()
