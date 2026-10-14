"""Run the whole V3 pipeline, step by step, with a log per step.

    .venv\\Scripts\\python scripts\\pipeline\\run_pipeline.py                  # everything
    .venv\\Scripts\\python scripts\\pipeline\\run_pipeline.py --from train     # resume at a step
    .venv\\Scripts\\python scripts\\pipeline\\run_pipeline.py --only export    # one step
    .venv\\Scripts\\python scripts\\pipeline\\run_pipeline.py --list

Steps: check (catalog sanity) -> views (labelled) -> candidates (unlabelled views) -> train ->
score -> export (star map) -> scoreboard -> cv (cross-validation) -> analyze (error analysis). It stops at the first failing
step. The slow steps resume on their own when re-run: view building skips finished views, and
training reloads finished networks from checkpoints. Logs: logs/pipeline/<step>.log (git-ignored).
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOGS = ROOT / 'logs' / 'pipeline'
STEPS = {
    'check': ['scripts/pipeline/check_catalog.py', '--strict'],
    'views': ['scripts/pipeline/build_full_dataset.py'],
    'candidates': ['scripts/pipeline/build_full_dataset.py', '--candidates'],
    'train': ['scripts/pipeline/train_star_gazer.py', '--diagnostics', '--ensemble', '5'],
    'score': ['scripts/pipeline/score_candidates.py'],
    'export': ['scripts/starmap/export_starmap.py'],
    'scoreboard': ['scripts/pipeline/scoreboard.py', 'record'],
    'cv': ['scripts/pipeline/cross_validate.py'],
    'analyze': ['scripts/experiments/analyze_results.py'],
}
THREADED = {'train', 'cv'}   # get --threads


def run_step(name, threads):
    cmd = [sys.executable, *STEPS[name]]
    if threads and name in THREADED:
        cmd += ['--threads', str(threads)]
    log = LOGS / f'{name}.log'
    env = {**os.environ, 'PYTHONIOENCODING': 'utf-8', 'TF_CPP_MIN_LOG_LEVEL': '3'}
    start = time.time()
    print(f'== {name} started {time.strftime("%H:%M")}  ({" ".join(STEPS[name])})', flush=True)
    with log.open('w', encoding='utf-8') as out:
        code = subprocess.run(cmd, cwd=ROOT, stdout=out, stderr=subprocess.STDOUT, env=env, check=False).returncode
    minutes = (time.time() - start) / 60
    tail = log.read_text(encoding='utf-8', errors='replace').strip().splitlines()[-8:]
    if code:
        shown = log.relative_to(ROOT) if log.is_relative_to(ROOT) else log
        print(f'== {name} FAILED after {minutes:.0f} min (exit {code}); last lines of {shown}:')
        print('\n'.join(f'   {line}' for line in tail))
        return False
    print(f'== {name} done in {minutes:.0f} min')
    print('\n'.join(f'   {line}' for line in tail[-3:]), flush=True)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--from', dest='start', choices=list(STEPS), help='start at this step')
    parser.add_argument('--only', choices=list(STEPS), help='run just this step')
    parser.add_argument('--skip', nargs='*', default=[], choices=list(STEPS), help='steps to leave out')
    parser.add_argument('--threads', type=int, default=10, help='CPU threads for train / cv')
    parser.add_argument('--list', action='store_true', help='show the steps and exit')
    args = parser.parse_args()
    if args.list:
        for name, cmd in STEPS.items():
            print(f'{name:11s} {" ".join(cmd)}')
        return
    names = list(STEPS)
    if args.only:
        names = [args.only]
    elif args.start:
        names = names[names.index(args.start):]
    names = [n for n in names if n not in args.skip]
    LOGS.mkdir(parents=True, exist_ok=True)
    for name in names:
        if not run_step(name, args.threads):
            sys.exit(f'Stopped at "{name}". Fix it, then: scripts/pipeline/run_pipeline.py --from {name}')
    print(f'== pipeline complete {time.strftime("%H:%M")}')


if __name__ == '__main__':
    main()
