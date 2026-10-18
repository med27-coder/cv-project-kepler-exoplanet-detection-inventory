"""PreToolUse hook (Bash and PowerShell): never let a git command stage or commit the Star Gazer key or other secrets.

The command is split the way a shell splits it (quotes removed, ; && || | as separators, heredoc bodies dropped), then
each git call is read past its global options (-C, -c, --git-dir...) to its real subcommand:
  add / stage / update-index  naming .secrets/, a *.key, *.pem or .env file          -> refused
  commit with --no-verify (any abbreviation, --no-v...) or a short -n                 -> refused (skips the git hook)
  commit naming a secret path, or while a secret file is already staged               -> refused
  -c core.hooksPath=..., git config core.hooksPath <value>, GIT_CONFIG_* variables    -> refused (redirects the hook)
Commit messages are values, not paths: a message that mentions the key is fine.

This is one layer of four: .gitignore keeps the key out of `git add .`; the git pre-commit hook
(precommit_secrets.py) checks the real index on every commit; and CI fails if a secret file is ever tracked
(tests/test_repo_hygiene.py).
"""
import json
import re
import shlex
import subprocess
import sys

SECRET = re.compile(r'(^|[/\\])(\.secrets([/\\]|$)|[^/\\]*\.(key|pem)$|\.env(\.[\w-]+)?$)', re.IGNORECASE)
SEPARATORS = {';', '&&', '||', '|', '&', '\n'}
GLOBAL_WITH_VALUE = {'-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix',
                     '--config-env', '--attr-source'}
COMMIT_WITH_VALUE = {'-m', '--message', '-F', '--file', '-C', '--reuse-message', '-c', '--reedit-message',
                     '--author', '--date', '-t', '--template', '--cleanup', '--fixup', '--squash', '--trailer',
                     '--pathspec-from-file'}
SHORT_VALUE_FLAGS = set('mFCctu')   # in a short cluster, the rest of the token is this option's value
HEREDOC = re.compile(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?^\s*\2\s*$", re.DOTALL | re.MULTILINE)


def deny(reason):
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                                             'permissionDecisionReason': 'Blocked by .claude/hooks/guard_secrets.py: '
                                             + reason}}))
    sys.exit(0)


def segments(cmd):
    lex = shlex.shlex(HEREDOC.sub(' ', cmd), posix=True, punctuation_chars=';&|')
    lex.whitespace_split = True
    lex.commenters = ''
    seg = []
    for tok in lex:
        if tok in SEPARATORS or set(tok) <= set(';&|'):
            if seg:
                yield seg
            seg = []
        else:
            seg.append(tok)
    if seg:
        yield seg


def is_git(tok):
    return re.search(r'(^|[/\\])git(\.exe)?$', tok, re.IGNORECASE) is not None


def hooks_path(text):
    return 'core.hookspath' in text.lower()


def check_commit(args):
    k = 0
    while k < len(args):
        a = args[k]
        if a == '--':
            if any(SECRET.search(p) for p in args[k + 1:]):
                deny('this git commit names a secret file.')
            return
        if a.startswith('--'):
            name = a.split('=', 1)[0]
            if len(name) > 5 and '--no-verify'.startswith(name):
                deny('git commit --no-verify would skip the pre-commit hook that guards the key.')
            if name in COMMIT_WITH_VALUE and '=' not in a:
                k += 1
        elif a.startswith('-') and len(a) > 1:
            for j, ch in enumerate(a[1:]):
                if ch == 'n':
                    deny('git commit -n (--no-verify) would skip the pre-commit hook that guards the key.')
                if ch in SHORT_VALUE_FLAGS:
                    if j == len(a) - 2 and ch != 'u':   # the value is the next token (-u takes it glued only)
                        k += 1
                    break
        elif SECRET.search(a):
            deny('this git commit names a secret file.')
        k += 1


def check_git(args, env):
    if any(k.upper().startswith('GIT_CONFIG') for k in env):
        deny('setting GIT_CONFIG_* could redirect the git hook that guards the key.')
    k = 0
    while k < len(args) and args[k].startswith('-'):
        a = args[k]
        if a in ('-c', '--config-env') and k + 1 < len(args) and hooks_path(args[k + 1]):
            deny('changing core.hooksPath would bypass the git pre-commit hook that guards the key.')
        k += 2 if a in GLOBAL_WITH_VALUE else 1
    if k >= len(args):
        return
    sub, rest = args[k].lower(), args[k + 1:]
    if sub in ('add', 'stage', 'update-index') and any(SECRET.search(a) for a in rest if not a.startswith('-')):
        deny('this git command stages a secret (.secrets/, *.key, *.pem or .env). The Star Gazer key must never be '
             'committed.')
    reading = any(a in ('--get', '--get-all', '--list', '-l', 'get', '--show-origin') for a in rest)
    if sub == 'config' and any(hooks_path(a) for a in rest) and not reading:
        deny('changing core.hooksPath would bypass the git pre-commit hook that guards the key.')
    if sub == 'commit':
        check_commit(rest)
        return True
    return False


def main():
    data = json.load(sys.stdin)
    cmd = (data.get('tool_input') or {}).get('command', '')
    if not re.search(r'git', cmd, re.IGNORECASE):
        return
    try:
        segs = list(segments(cmd))
    except ValueError:   # unbalanced quotes: a shell would refuse it too; refuse if it could touch a secret
        if SECRET.search(cmd.replace('"', ' ').replace("'", ' ')) or hooks_path(cmd):
            deny('could not read this command safely, and it mentions a secret.')
        return
    commits = False
    for seg in segs:
        env = []
        while seg and re.match(r'^[A-Za-z_]\w*=', seg[0]):
            env.append(seg.pop(0))
        for i, tok in enumerate(seg):   # also after wrappers like `env`, `command`, `&`, `cmd /c`
            if is_git(tok):
                commits |= bool(check_git(seg[i + 1:], env))
                break
    if commits:
        out = subprocess.run(['git', 'diff', '--cached', '--name-only'], capture_output=True, text=True, check=False)
        bad = [f for f in out.stdout.splitlines() if SECRET.search(f)] if out.returncode == 0 else []
        if bad:
            deny(f'secret files are staged ({", ".join(bad)}). Unstage them with git restore --staged.')


if __name__ == '__main__':
    main()
