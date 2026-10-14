"""Prediction scoreboard: was Star Gazer right about the candidates NASA has since decided?

    .venv\\Scripts\\python scripts\\pipeline\\scoreboard.py record    # after score_candidates.py
    .venv\\Scripts\\python scripts\\pipeline\\scoreboard.py check     # any time later (downloads NASA's table)

record: saves the current candidate scores as public files (the same numbers the star map shows,
never the model): results/v3_public/candidate_scores.csv + .json (latest; the star map export
falls back to these, so the monthly refresh works without the encrypted model) and a dated copy
results/scoreboard/scores_<date>.csv.

check: compares every recorded snapshot with NASA's current dispositions. A candidate that NASA
has since CONFIRMED counts as a hit if Star Gazer scored it above its threshold; one that became a
FALSE POSITIVE counts as a hit if it scored below. Writes results/scoreboard/report.json. These
KOIs were never in the training data (the model trains only on already-decided KOIs), so this is
an honest, out-of-sample test that grows as NASA works through the candidates.
"""

import argparse
import json
import sys
from datetime import datetime, timezone

import pandas as pd

from kepler_cnn import config as C
from kepler_cnn import star_gazer as S

SCORES = C.PROJECT_ROOT / 'results' / 'v3' / 'candidates.csv'
PUBLIC = C.PROJECT_ROOT / 'results' / 'v3_public'
BOARD = C.PROJECT_ROOT / 'results' / 'scoreboard'
COLUMNS = ['kepoi_name', 'star_gazer_prob', 'above_threshold']
DISPOSITIONS_URL = ('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+kepoi_name,'
                    'koi_disposition+from+cumulative&format=csv')


def record(_args):
    if not SCORES.exists():
        sys.exit(f'{C.rel(SCORES)} not found; run scripts/pipeline/score_candidates.py first.')
    scores = pd.read_csv(SCORES)[COLUMNS]
    threshold = json.loads(S.THRESHOLD_FILE.read_text())
    today = datetime.now(timezone.utc).date().isoformat()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    BOARD.mkdir(parents=True, exist_ok=True)
    scores.to_csv(PUBLIC / 'candidate_scores.csv', index=False, float_format='%.4f')
    meta = {'scored': today, 'threshold': threshold.get('threshold'),
            'view_version': threshold.get('view_version'), 'n': len(scores)}
    (PUBLIC / 'candidate_scores.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
    scores.to_csv(BOARD / f'scores_{today}.csv', index=False, float_format='%.4f')
    print(f'Recorded {len(scores)} candidate scores for {today} (threshold {meta["threshold"]}).')


def evaluate(snapshot, now):
    """Score one snapshot against current dispositions: {'confirmed': {...}, 'false_positive': {...}}."""
    merged = snapshot.merge(now, on='kepoi_name', how='inner')
    out = {}
    for disp, key, hit in (('CONFIRMED', 'confirmed', True), ('FALSE POSITIVE', 'false_positive', False)):
        decided = merged[merged['koi_disposition'] == disp]
        right = int((decided['above_threshold'].astype(bool) == hit).sum())
        out[key] = {'n': len(decided), 'star_gazer_right': right,
                    'examples': decided['kepoi_name'].head(10).tolist()}
    out['still_candidate'] = int((merged['koi_disposition'] == 'CANDIDATE').sum())
    return out


def check(args):
    snapshots = sorted(BOARD.glob('scores_*.csv'))
    if not snapshots:
        sys.exit('No recorded scores yet; run "record" after scoring.')
    now = pd.read_csv(args.dispositions or DISPOSITIONS_URL)[['kepoi_name', 'koi_disposition']]
    report = {'checked': datetime.now(timezone.utc).date().isoformat(), 'snapshots': {}}
    for path in snapshots:
        res = evaluate(pd.read_csv(path), now)
        report['snapshots'][path.stem.removeprefix('scores_')] = res
        decided = res['confirmed']['n'] + res['false_positive']['n']
        right = res['confirmed']['star_gazer_right'] + res['false_positive']['star_gazer_right']
        line = f'{right}/{decided} right' if decided else 'none decided yet'
        print(f'{path.stem}: {line} ({res["confirmed"]["n"]} confirmed, {res["false_positive"]["n"]} '
              f'false positives since; {res["still_candidate"]} still candidates)')
    (BOARD / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='cmd', required=True)
    sub.add_parser('record').set_defaults(fn=record)
    c = sub.add_parser('check')
    c.add_argument('--dispositions', help='local CSV with kepoi_name, koi_disposition (default: NASA, live)')
    c.set_defaults(fn=check)
    args = parser.parse_args()
    args.fn(args)


if __name__ == '__main__':
    main()
