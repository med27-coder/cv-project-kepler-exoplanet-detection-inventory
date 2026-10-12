"""Export the Kepler systems for the pixel star map (web/) to web/data/systems.js.

    .venv\\Scripts\\python scripts\\export_starmap.py

Every star with at least one CONFIRMED or CANDIDATE KOI becomes a pixel on the map.
A system is *drawn* (exported in full, star + planets) when it has a confirmed planet or
a candidate that Star Gazer has scored (results/v3/candidates.csv, from
scripts/score_candidates.py). The rest are listed by name only, so the page can answer
"soon to cross the stars". SPOTLIGHT systems twinkle on the map and get a quick-pick button.

Reads data/raw/koi_cumulative_full.csv (downloaded by scripts/build_full_dataset.py).
The output is a .js file (not .json) so web/index.html also works opened straight from disk.
Only public numbers are exported: catalog values and Star Gazer's score per candidate,
never the model itself.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from kepler_cnn import config as C

CATALOG = C.RAW_DIR / 'koi_cumulative_full.csv'
SCORES = C.PROJECT_ROOT / 'results' / 'v3' / 'candidates.csv'
THRESHOLD = C.MODELS_DIR / 'v3' / 'threshold.json'   # Star Gazer's decision threshold
PLANETS = C.RAW_DIR / 'ps_kepler_planets.csv'
# NASA's confirmed-planet table (one row per planet, best values) for the Kepler field:
# masses, distances, discovery year, and planets found by other methods (RV, TTV).
# Hosts are matched to KOI stars by position (names differ: Kepler-90 is "KOI-351" there).
PLANETS_URL = ('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+'
               'pl_name,hostname,ra,dec,discoverymethod,disc_year,sy_dist,pl_bmasse,pl_bmassprov,'
               'pl_orbper,pl_orbsmax,pl_rade,pl_eqt+from+pscomppars+where+'
               'ra+between+279+and+303+and+dec+between+35+and+54&format=csv')
MATCH_ARCSEC = 3.0      # host star <-> KOI star position match
MATCH_PERIOD = 0.01     # planet <-> KOI match: periods within 1%
MEASURED_MASS = {'Mass', 'Msini', 'Msin(i)/sin(i)'}   # otherwise estimated from a mass-radius relation
OUT_FILE = C.PROJECT_ROOT / 'web' / 'data' / 'systems.js'
MAX_BYTES = 1_500_000   # keep the page light; warn above this

# Well-known multi-planet and habitable-zone systems: twinkle on the map, quick-pick buttons.
SPOTLIGHT = ['Kepler-90', 'Kepler-11', 'Kepler-186', 'Kepler-22', 'Kepler-452', 'Kepler-62',
             'Kepler-444', 'Kepler-10', 'Kepler-20', 'Kepler-37', 'Kepler-80', 'Kepler-1649',
             'Kepler-442', 'Kepler-69']

STATUS = {'CONFIRMED': 'confirmed', 'CANDIDATE': 'candidate'}
KOI_NAME = re.compile(r'K(\d{5})\.(\d{2})')
COLUMNS = ['name', 'kepid', 'koi', 'ra', 'dec', 'kepmag', 'spot', 'drawn', 'kois', 'sg']


def koi_host(kepoi_name):
    """'K00351.01' -> 351 (the KOI number shared by every KOI on the same star)."""
    m = KOI_NAME.fullmatch(str(kepoi_name))
    return int(m.group(1)) if m else None


def system_name(rows):
    """'Kepler-90' from any planet named 'Kepler-90 b', else 'KOI-351' from the KOI number."""
    for name in rows['kepler_name'].dropna():
        return re.sub(r'\s+[a-z]$', '', str(name).strip())
    return f'KOI-{koi_host(rows["kepoi_name"].iloc[0])}'


def _num(value, digits):
    return None if pd.isna(value) else round(float(value), digits)


def _sma(row):
    """Orbit size in AU; Kepler's third law (stellar mass, else 1 Msun) when the catalog has none."""
    if pd.notna(row.get('koi_sma')):
        return float(row['koi_sma'])
    mass = row.get('koi_smass')
    mass = float(mass) if pd.notna(mass) and mass > 0 else 1.0
    return (float(row['koi_period']) / 365.25) ** (2 / 3) * mass ** (1 / 3)


def load_scores(path):
    """{kepoi_name: (probability, above threshold)} from score_candidates.py, or {} if not run yet."""
    if not Path(path).exists():
        return {}
    table = pd.read_csv(path)
    return {k: (float(p), bool(a)) for k, p, a in
            zip(table['kepoi_name'], table['star_gazer_prob'], table['above_threshold'])}


def load_planets(path=PLANETS, download=True):
    """NASA confirmed-planet table for the Kepler field (downloaded once), or None."""
    path = Path(path)
    if not path.exists():
        if not download:
            return None
        print('Downloading the confirmed-planet table (pscomppars) for Kepler systems...')
        path.parent.mkdir(parents=True, exist_ok=True)
        pd.read_csv(PLANETS_URL).to_csv(path, index=False)
    return pd.read_csv(path)


def match_hosts(stars, planets, max_arcsec=MATCH_ARCSEC):
    """{kepid: planet rows} pairing each planet's host with the nearest KOI star by position.

    stars: one row per star with kepid, ra, dec (degrees)."""
    if planets is None or planets.empty:
        return {}
    hosts = planets.groupby('hostname')[['ra', 'dec']].first()
    s_ra, s_dec = np.radians(stars['ra'].to_numpy()), np.radians(stars['dec'].to_numpy())
    out = {}
    for host, (ra, dec) in hosts.iterrows():
        if pd.isna(ra) or pd.isna(dec):
            continue
        ra, dec = np.radians(ra), np.radians(dec)
        # small-angle separation in arcsec
        sep = np.degrees(np.hypot((s_ra - ra) * np.cos(dec), s_dec - dec)) * 3600
        i = int(np.argmin(sep))
        if sep[i] <= max_arcsec:
            kepid = int(stars['kepid'].iloc[i])
            rows = planets[planets['hostname'] == host]
            out[kepid] = rows if kepid not in out else pd.concat([out[kepid], rows])
    return out


def _pop_match(extras, name, period):
    """Remove and return the pscomppars row for this KOI planet (by name, else by period), or None."""
    if not extras:
        return None
    if name in extras:
        return extras.pop(name)
    if period is None:
        return None
    for key, ps in extras.items():
        if pd.notna(ps['pl_orbper']) and abs(ps['pl_orbper'] - period) <= MATCH_PERIOD * period:
            return extras.pop(key)
    return None


def _extra_fields(ps):
    """Mass and discovery year from one pscomppars row."""
    out = {}
    if pd.notna(ps['pl_bmasse']):
        out['mass'] = round(float(ps['pl_bmasse']), 2)   # Earth masses
        out['mass_kind'] = 'measured' if ps['pl_bmassprov'] in MEASURED_MASS else 'estimated'
    if pd.notna(ps['disc_year']):
        out['year'] = int(ps['disc_year'])
    return out


def _other_method_planet(ps, star_mass):
    """A planet NASA lists in the system that is not a KOI (found by RV, TTV, ...)."""
    period = ps['pl_orbper']
    if pd.isna(period):
        return None
    sma = ps['pl_orbsmax']
    if pd.isna(sma):
        sma = (float(period) / 365.25) ** (2 / 3) * star_mass ** (1 / 3)
    return {'name': ps['pl_name'], 'koi': ps['pl_name'], 'status': 'other',
            'method': str(ps['discoverymethod']).lower(), 'radius': _num(ps['pl_rade'], 2),
            'period': _num(period, 3), 'sma': round(float(sma), 4), 'teq': _num(ps['pl_eqt'], 0),
            **_extra_fields(ps)}


def system_detail(rows, scores, extras=None):
    """Star + planets for one system; `extras` = this system's rows of the pscomppars table."""
    star = rows.iloc[0]
    by_name = {} if extras is None else {r['pl_name']: r for _, r in extras.iterrows()}   # unmatched rows
    planets = []
    for _, r in rows.sort_values('koi_period').iterrows():
        planet = {
            'name': r['kepler_name'] if pd.notna(r['kepler_name']) else r['kepoi_name'],
            'koi': r['kepoi_name'],
            'status': STATUS[r['koi_disposition']],
            'radius': _num(r['koi_prad'], 2),          # Earth radii
            'period': _num(r['koi_period'], 3),        # days
            'sma': round(_sma(r), 4),                  # AU
            'teq': _num(r['koi_teq'], 0),              # K
        }
        if r['kepoi_name'] in scores:
            prob, above = scores[r['kepoi_name']]
            planet['sg'], planet['sg_planet'] = round(prob, 3), above
        ps = _pop_match(by_name, planet['name'], planet['period'])
        if ps is not None:
            planet.update(_extra_fields(ps))
        planets.append(planet)
    smass = star.get('koi_smass')
    smass = float(smass) if pd.notna(smass) and smass > 0 else 1.0
    planets += [p for p in (_other_method_planet(ps, smass) for ps in by_name.values()) if p]
    planets.sort(key=lambda p: p['period'] if p['period'] is not None else np.inf)
    detail = {'kepid': int(star['kepid']), 'teff': _num(star['koi_steff'], 0),
              'srad': _num(star['koi_srad'], 3), 'kepmag': _num(star['koi_kepmag'], 2),
              'ra': round(float(star['ra']), 5), 'dec': round(float(star['dec']), 5)}
    if extras is not None and len(extras) and pd.notna(extras['sy_dist'].iloc[0]):
        detail['dist_pc'] = round(float(extras['sy_dist'].iloc[0]), 1)
    detail['planets'] = planets
    return detail


def build(catalog, spotlight=SPOTLIGHT, scores=None, planets=None, threshold=0.5):
    """Map pixels for every star with a non-false-positive KOI, full detail for drawn systems.
    `planets` (optional) is NASA's confirmed-planet table, for masses, distances and non-KOI planets."""
    scores = scores or {}
    kois = catalog[catalog['koi_disposition'].isin(list(STATUS))]
    kois = kois.dropna(subset=['ra', 'dec', 'koi_period'])
    hosts = match_hosts(kois.groupby('kepid', as_index=False)[['ra', 'dec']].first(), planets)
    stars, systems = [], {}
    wanted = set(spotlight)
    for kepid, rows in kois.groupby('kepid', sort=True):
        name = system_name(rows)
        cand = rows[rows['koi_disposition'] == 'CANDIDATE']['kepoi_name']
        cand_scores = [scores[k][0] for k in cand if k in scores]
        drawn = bool((rows['koi_disposition'] == 'CONFIRMED').any() or cand_scores)
        if drawn:
            systems[name] = system_detail(rows, scores, hosts.get(int(kepid)))
        mag = rows['koi_kepmag'].iloc[0]
        stars.append([name, int(kepid), koi_host(rows['kepoi_name'].iloc[0]),
                      round(float(rows['ra'].iloc[0]), 4), round(float(rows['dec'].iloc[0]), 4),
                      None if pd.isna(mag) else round(float(mag), 1), int(name in wanted), int(drawn),
                      len(rows), round(max(cand_scores), 3) if cand_scores else None])
    names = {s[0] for s in stars}
    missing = sorted(wanted - names)
    return {'source': 'NASA Exoplanet Archive, KOI cumulative table',
            'exported': datetime.now(timezone.utc).date().isoformat(),
            'scored': bool(scores), 'sg_threshold': threshold,
            'columns': COLUMNS, 'spotlight': [n for n in spotlight if n in names],
            'stars': stars, 'systems': systems}, missing


def to_js(data):
    body = json.dumps(data, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    return ('// Generated by scripts/export_starmap.py from the NASA Exoplanet Archive. Do not edit.\n'
            f'window.STARMAP = {body};\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--catalog', type=Path, default=CATALOG)
    parser.add_argument('--scores', type=Path, default=SCORES,
                        help='Star Gazer candidate scores (scripts/score_candidates.py); skipped if missing')
    parser.add_argument('--planets', type=Path, default=PLANETS,
                        help="NASA's confirmed-planet table for Kepler systems (downloaded if missing)")
    parser.add_argument('--offline', action='store_true', help="don't download the planet table")
    parser.add_argument('--out', type=Path, default=OUT_FILE)
    args = parser.parse_args()
    if not args.catalog.exists():
        sys.exit(f'{C.rel(args.catalog)} not found; run scripts/build_full_dataset.py first.')

    catalog = pd.read_csv(args.catalog, low_memory=False).replace([np.inf, -np.inf], np.nan)
    scores = load_scores(args.scores)
    planets = load_planets(args.planets, download=not args.offline)
    threshold = json.loads(THRESHOLD.read_text())['threshold'] if scores and THRESHOLD.exists() else 0.5
    data, missing = build(catalog, scores=scores, planets=planets, threshold=threshold)
    if missing:
        print(f'Warning: spotlight systems not in the catalog: {", ".join(missing)}')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    js = to_js(data)
    args.out.write_text(js, encoding='utf-8')
    size = len(js.encode('utf-8'))
    print(f'Saved {C.rel(args.out)}: {len(data["stars"])} stars, {len(data["systems"])} drawn systems, '
          f'{len(scores)} Star Gazer scores, {size / 1024:.0f} KB')
    if size > MAX_BYTES:
        print(f'Warning: over {MAX_BYTES / 1e6:.1f} MB; consider lazy-loading system details.')


if __name__ == '__main__':
    main()
