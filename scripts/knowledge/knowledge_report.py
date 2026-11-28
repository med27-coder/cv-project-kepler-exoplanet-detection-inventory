"""The knowledge report for the monthly data refresh: what NASA's new data changed on the map.

    python scripts/knowledge/knowledge_report.py                    # the working tree's web/data against HEAD
    python scripts/knowledge/knowledge_report.py --before v1.9.9    # against any git ref
    python scripts/knowledge/knowledge_report.py --out body.md      # the pull request's text, report included

Run after export_starmap.py (.github/workflows/data-refresh.yml). It reports, from the exported files only:
NASA's new rulings on candidates (and whether Star Gazer had called each one right), newly confirmed planets, new
systems, planets or systems no longer in the data, and values that changed by more than CHANGE (radius, period,
starlight, temperature). It changes nothing: a person reads it in the pull request before merging
(docs/plans/KNOWLEDGE_AND_RESEARCHERS.md, sections 2 and 10).
"""

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = 'web/data'
CHANGE = 0.05            # a value counts as changed past 5%
WATCHED = {'radius': "radius (Earth's)", 'period': 'period (days)', 'insol': 'starlight (Earth = 1)',
           'teq': 'temperature (K)'}
LIST_AT_MOST = 25
INTRO = """Automated monthly refresh of the star map data from NASA's Exoplanet Archive, Gaia (Berger et al. 2020)
and JPL Horizons, plus the prediction scoreboard. Review the changes and the knowledge report below, then merge
to publish them.
"""


def parse_js_json(text: str, call: str) -> dict:
    """The JSON object inside a generated data file (`window.X = {...};` or `window.X(n, {...});`)."""
    if call == 'details':
        start = text.index(',', text.index('STARMAP_DETAILS(')) + 1
        return json.loads(text[start:text.rindex(')')])
    start = text.index('=', text.index('STARMAP_RESOLUTIONS')) + 1
    return json.loads(text[start:text.rindex(';')])


def git_show(ref: str, path: str) -> str | None:
    out = subprocess.run(['git', 'show', f'{ref}:{path}'], cwd=ROOT, capture_output=True, text=True,
                         encoding='utf-8', check=False)
    return out.stdout if out.returncode == 0 else None


def git_list(ref: str, folder: str) -> list[str]:
    out = subprocess.run(['git', 'ls-tree', '--name-only', f'{ref}:{folder}'], cwd=ROOT, capture_output=True,
                         text=True, check=False)
    return [f'{folder}/{n}' for n in out.stdout.split() if n.endswith('.js')] if out.returncode == 0 else []


def load(ref: str | None) -> tuple[dict, dict]:
    """(systems, rulings) from a git ref, or from the working tree when ref is None."""
    systems: dict = {}
    if ref is None:
        files = {f'{DATA}/details/{p.name}': p.read_text(encoding='utf-8')
                 for p in sorted((ROOT / DATA / 'details').glob('*.js'))}
        res = (ROOT / DATA / 'resolutions.js').read_text(encoding='utf-8')
    else:
        files = {f: git_show(ref, f) or '' for f in git_list(ref, f'{DATA}/details')}
        res = git_show(ref, f'{DATA}/resolutions.js') or ''
    for text in files.values():
        if text:
            systems.update(parse_js_json(text, 'details'))
    rulings = parse_js_json(res, 'resolutions').get('resolved', {}) if res else {}
    return systems, rulings


def planets(systems: dict) -> dict:
    """{planet name: planet with its system}."""
    return {p['name']: {**p, 'system': s} for s, d in systems.items() for p in d.get('planets', [])}


def compare(before: tuple[dict, dict], after: tuple[dict, dict]) -> dict:
    (sys0, rul0), (sys1, rul1) = before, after
    p0, p1 = planets(sys0), planets(sys1)
    by_koi = {p.get('koi'): p for p in p0.values() if p.get('koi')}
    kois_after = {p.get('koi') for p in p1.values() if p.get('koi')}
    rulings = []
    for koi in sorted(set(rul1) - set(rul0)):
        status, date = rul1[koi][0], rul1[koi][1]
        was = by_koi.get(koi, {})
        sg = was.get('sg_planet')
        rulings.append({'koi': koi, 'ruling': status, 'date': date, 'system': was.get('system', ''),
                        'sg_right': None if sg is None else sg == (status == 'confirmed')})
    confirmed = sorted(n for n, p in p1.items() if p.get('status') == 'confirmed'
                       and (n not in p0 or p0[n].get('status') != 'confirmed'))
    changed = []
    for n in sorted(set(p0) & set(p1)):
        for k, label in WATCHED.items():
            a, b = p0[n].get(k), p1[n].get(k)
            if isinstance(a, (int, float)) and isinstance(b, (int, float)) and a and abs(b - a) / abs(a) > CHANGE:
                changed.append({'planet': n, 'what': label, 'before': a, 'after': b})
    return {'rulings': rulings, 'confirmed': confirmed,
            'new_systems': sorted(set(sys1) - set(sys0)), 'gone_systems': sorted(set(sys0) - set(sys1)),
            'gone_planets': sorted(n for n in set(p0) - set(p1) if p0[n]['system'] in sys1
                                   and p0[n].get('koi') not in kois_after),   # renamed on confirmation: not gone
            'changed': changed}


def _list(items: list[str]) -> list[str]:
    shown = [f'- {i}' for i in items[:LIST_AT_MOST]]
    return shown + ([f'- ... and {len(items) - LIST_AT_MOST} more'] if len(items) > LIST_AT_MOST else [])


def render(diff: dict) -> str:
    out = ['## Knowledge report', '']
    if not any(diff.values()):
        return '\n'.join(out + ['No changes to planets, systems or rulings this month.', ''])
    r = diff['rulings']
    if r:
        judged = [x for x in r if x['sg_right'] is not None]
        out += [(f"**NASA ruled on {len(r)} candidate(s)** (these settle the players' calls on them). Star Gazer had "
                f"called {sum(x['sg_right'] for x in judged)} of {len(judged)} right."), '']
        out += _list([f"{x['koi']} ({x['system'] or 'system unknown'}): {x['ruling']}, first seen {x['date']}"
                      + ('' if x['sg_right'] is None else f"; Star Gazer {'right' if x['sg_right'] else 'wrong'}")
                      for x in r]) + ['']
    if diff['confirmed']:
        out += [f"**Newly confirmed planets: {len(diff['confirmed'])}**", ''] + _list(diff['confirmed']) + ['']
    if diff['new_systems']:
        out += [f"**New systems on the map: {len(diff['new_systems'])}**", ''] + _list(diff['new_systems']) + ['']
    if diff['gone_systems'] or diff['gone_planets']:
        out += ['**No longer in the data** (check why before merging: a rename, or NASA dropped it):', '']
        out += _list([f'system {s}' for s in diff['gone_systems']] + [f'planet {p}' for p in diff['gone_planets']]) + ['']
    if diff['changed']:
        out += [f"**Values that changed by more than {CHANGE:.0%}: {len(diff['changed'])}**", '']
        out += _list([f"{c['planet']}: {c['what']} {c['before']:g} -> {c['after']:g}" for c in diff['changed']]) + ['']
    out += ['Generated by `scripts/knowledge/knowledge_report.py` from the exported data; it changes nothing.', '']
    return '\n'.join(out)


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--before', default='HEAD', help='the git ref to compare against (default HEAD)')
    parser.add_argument('--out', type=Path, help='write the pull request text (intro and report) here')
    args = parser.parse_args(argv)
    report = render(compare(load(args.before), load(None)))
    if args.out:
        args.out.write_text(INTRO + '\n' + report, encoding='utf-8')
        print(f'Wrote {args.out}')
    else:
        print(report)


if __name__ == '__main__':
    main()
