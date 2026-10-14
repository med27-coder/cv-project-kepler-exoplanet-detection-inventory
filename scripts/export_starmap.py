"""Export the Kepler systems for the pixel star map (web/) to web/data/systems.js.

    .venv\\Scripts\\python scripts\\export_starmap.py

Every star with at least one CONFIRMED or CANDIDATE KOI becomes a pixel on the map, and every
one gets full details (star + planets), loaded by the page only when the system is opened:
web/data/systems.js is a small index (one row per star, highlight tags, the "next planets"
leaderboard) and web/data/details/NN.js hold the details in CHUNKS files. A system is *drawn*
when it has a confirmed planet or a candidate Star Gazer has scored (results/v3/candidates.csv);
systems with only unscored candidates are shown as unconfirmed ("soon to cross the stars").
SPOTLIGHT systems twinkle on the map and get a quick-pick button.

Reads data/raw/koi_cumulative_full.csv (downloaded by scripts/build_full_dataset.py).
The output is a .js file (not .json) so web/index.html also works opened straight from disk.
Only public numbers are exported: catalog values and Star Gazer's score per candidate,
never the model itself.
"""

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from kepler_cnn import config as C

CATALOG = C.RAW_DIR / 'koi_cumulative_full.csv'
SCORES = C.PROJECT_ROOT / 'results' / 'v3' / 'candidates.csv'
THRESHOLD = C.MODELS_DIR / 'v3' / 'threshold.json'   # Star Gazer's decision threshold
# Public copies of the scores (scripts/scoreboard.py record): used when the private results/v3 is
# absent, e.g. in the monthly refresh workflow, which has no access to the encrypted model.
PUBLIC_SCORES = C.PROJECT_ROOT / 'results' / 'v3_public' / 'candidate_scores.csv'
PLANETS = C.RAW_DIR / 'ps_kepler_planets.csv'
# NASA's confirmed-planet table (one row per planet, best values) for the Kepler field:
# masses, distances, discovery year, and planets found by other methods (RV, TTV).
# Hosts are matched to KOI stars by position (names differ: Kepler-90 is "KOI-351" there).
PLANETS_URL = ('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+'
               'pl_name,hostname,ra,dec,discoverymethod,disc_year,sy_dist,pl_bmasse,pl_bmassprov,'
               'pl_orbper,pl_orbsmax,pl_rade,pl_eqt,pl_orbeccen,pl_orblper,pl_insol,sy_snum,st_spectype'
               '+from+pscomppars+where+ra+between+279+and+303+and+dec+between+35+and+54&format=csv')
PLANET_COLUMNS = {'pl_orbeccen', 'pl_orblper', 'pl_insol', 'sy_snum', 'st_spectype'}   # newest additions (re-download if missing)
TOIS = C.RAW_DIR / 'toi_kepler_field.csv'
# TESS Objects of Interest in the Kepler field: Kepler stars that TESS also flagged.
TOIS_URL = ('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=select+'
            'toi,tid,ra,dec,pl_orbper,tfopwg_disp+from+toi+where+'
            'ra+between+279+and+303+and+dec+between+35+and+54&format=csv')
GAIA = C.RAW_DIR / 'berger2020_gaia_kepler.csv'   # scripts/fetch_extra_data.py gaia_stars
MATCH_ARCSEC = 3.0      # host star <-> KOI star position match
MATCH_PERIOD = 0.01     # planet <-> KOI match: periods within 1%
MEASURED_MASS = {'Mass', 'Msini', 'Msin(i)/sin(i)'}   # otherwise estimated from a mass-radius relation
OUT_FILE = C.PROJECT_ROOT / 'web' / 'data' / 'systems.js'
MAX_BYTES = 400_000      # the index the page loads up front; warn above this
CHUNK_MAX_BYTES = 150_000   # each details file
CHUNKS = 32

# Well-known multi-planet and habitable-zone systems: twinkle on the map, quick-pick buttons.
SPOTLIGHT = ['Kepler-90', 'Kepler-11', 'Kepler-186', 'Kepler-22', 'Kepler-452', 'Kepler-62',
             'Kepler-444', 'Kepler-10', 'Kepler-20', 'Kepler-37', 'Kepler-80', 'Kepler-1649',
             'Kepler-442', 'Kepler-69']

STATUS = {'CONFIRMED': 'confirmed', 'CANDIDATE': 'candidate'}
KOI_NAME = re.compile(r'K(\d{5})\.(\d{2})')
COLUMNS = ['name', 'kepid', 'koi', 'ra', 'dec', 'kepmag', 'spot', 'drawn', 'kois', 'sg',
           'np', 'nconf', 'tags', 'chunk']
# Highlight tags (bit flags in the 'tags' column), worked out here so the page can light them up
# without loading every system's details. Same rules as the page's highlight buttons.
TAGS = {'hz': 1, 'earth': 2, 'multi': 4, 'giant': 8, 'tess': 16, 'unscored': 32}
FLAG_NAMES = {'koi_fpflag_nt': 'not transit-like', 'koi_fpflag_ss': 'stellar eclipse',
              'koi_fpflag_co': 'centroid offset', 'koi_fpflag_ec': 'ephemeris match'}


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


def _cached_table(path, url, what, download=True, columns=()):
    """A NASA table saved under data/raw (downloaded once, again if it lacks `columns`), or None."""
    path = Path(path)
    if path.exists() and not set(columns) - set(pd.read_csv(path, nrows=0).columns):
        return pd.read_csv(path)
    if not download:
        return pd.read_csv(path) if path.exists() else None
    print(f'Downloading {what}...')
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.read_csv(url).to_csv(path, index=False)
    return pd.read_csv(path)


def load_planets(path=PLANETS, download=True):
    """NASA confirmed-planet table for the Kepler field, or None."""
    return _cached_table(path, PLANETS_URL, 'the confirmed-planet table (pscomppars) for Kepler systems',
                         download, PLANET_COLUMNS)


def load_tois(path=TOIS, download=True):
    """NASA's TESS Objects of Interest table for the Kepler field, or None."""
    return _cached_table(path, TOIS_URL, 'the TESS Objects of Interest (TOI) table', download)


def load_gaia(path=GAIA):
    """{kepid: Berger et al. 2020 Gaia-based star row}, or {} if not downloaded."""
    path = Path(path)
    if not path.exists():
        return {}
    table = pd.read_csv(path).drop_duplicates('kepid').set_index('kepid')
    return {int(k): row for k, row in table.iterrows()}


def match_hosts(stars, planets, max_arcsec=MATCH_ARCSEC, key='hostname'):
    """{kepid: planet rows} pairing each planet's host with the nearest KOI star by position.

    stars: one row per star with kepid, ra, dec (degrees). `key`: the column naming each host."""
    if planets is None or planets.empty:
        return {}
    hosts = planets.groupby(key)[['ra', 'dec']].first()
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
            rows = planets[planets[key] == host]
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
    """Mass, discovery year, eccentricity and insolation from one pscomppars row."""
    out = {}
    if pd.notna(ps['pl_bmasse']):
        out['mass'] = round(float(ps['pl_bmasse']), 2)   # Earth masses
        out['mass_kind'] = 'measured' if ps['pl_bmassprov'] in MEASURED_MASS else 'estimated'
    if pd.notna(ps['disc_year']):
        out['year'] = int(ps['disc_year'])
    if pd.notna(ps.get('pl_orbeccen')) and 0 < ps['pl_orbeccen'] < 1:
        out['ecc'] = round(float(ps['pl_orbeccen']), 3)
    if pd.notna(ps.get('pl_insol')):
        out['insol'] = round(float(ps['pl_insol']), 2)   # sunlight relative to Earth
    if out.get('ecc') and pd.notna(ps.get('pl_orblper')):
        out['w'] = round(float(ps['pl_orblper']), 1)     # argument of periastron (deg): orbit orientation
    return out


TESS_KEEP = {'KP', 'CP', 'PC', 'APC'}   # TOI dispositions kept: known/confirmed planet, candidates


def tess_matches(tois, period):
    """'TOI-1161.01' for the TESS object on this star whose period is within 1% of `period`, else None."""
    if tois is None or period is None:
        return None
    for _, t in tois.iterrows():
        if t['tfopwg_disp'] in TESS_KEEP and pd.notna(t['pl_orbper']) \
                and abs(t['pl_orbper'] - period) <= MATCH_PERIOD * period:
            return f'TOI-{t["toi"]:.2f}'
    return None


def star_facts(star, extras, gaia_row):
    """Star mass, age, metals, gravity, distance: NASA's tables first, Berger et al. 2020 (Gaia) after."""
    def pick(*values, digits=2):
        for v in values:
            if v is not None and pd.notna(v):
                return round(float(v), digits)
        return None

    g = gaia_row if gaia_row is not None else {}
    ps = extras.iloc[0] if extras is not None and len(extras) else {}
    facts = {'smass': pick(star.get('koi_smass'), g.get('gaia_smass')),
             'age': pick(g.get('gaia_age'), digits=1),           # Gyr (Gaia isochrones; uncertain)
             'met': pick(g.get('gaia_smet'), star.get('koi_smet')),   # [Fe/H], 0 = like the Sun
             'logg': pick(g.get('gaia_slogg'), star.get('koi_slogg')),
             'dist_pc': pick(ps.get('sy_dist'), g.get('gaia_dist_pc'), digits=1)}
    if ps is not None and len(ps):
        if pd.notna(ps.get('sy_snum')) and ps['sy_snum'] > 1:
            facts['nstars'] = int(ps['sy_snum'])
        if isinstance(ps.get('st_spectype'), str) and ps['st_spectype'].strip():
            facts['spectype'] = ps['st_spectype'].strip()
    return {k: v for k, v in facts.items() if v is not None}


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


def system_detail(rows, scores, extras=None, gaia_row=None, tois=None):
    """Star + planets for one system. `extras`: this system's rows of the pscomppars table;
    `gaia_row`: the star's Berger et al. 2020 row; `tois`: TESS objects on the same star."""
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
        if pd.notna(r.get('koi_insol')):
            planet['insol'] = round(float(r['koi_insol']), 2)   # replaced by NASA's value when matched
        if r['kepoi_name'] in scores:
            prob, above = scores[r['kepoi_name']]
            planet['sg'], planet['sg_planet'] = round(prob, 3), above
        if planet['status'] == 'candidate':   # NASA's own vetting, for the candidate's case file
            if pd.notna(r.get('koi_score')):
                planet['nasa'] = round(float(r['koi_score']), 3)
            if pd.notna(r.get('koi_model_snr')):
                planet['snr'] = round(float(r['koi_model_snr']), 1)
            flags = [label for col, label in FLAG_NAMES.items() if r.get(col) == 1]
            if flags:
                planet['flags'] = flags
        ps = _pop_match(by_name, planet['name'], planet['period'])
        if ps is not None:
            planet.update(_extra_fields(ps))
        toi = tess_matches(tois, planet['period'])
        if toi:
            planet['toi'] = toi
        planets.append(planet)
    smass = star.get('koi_smass')
    smass = float(smass) if pd.notna(smass) and smass > 0 else 1.0
    planets += [p for p in (_other_method_planet(ps, smass) for ps in by_name.values()) if p]
    planets.sort(key=lambda p: p['period'] if p['period'] is not None else np.inf)
    detail = {'kepid': int(star['kepid']), 'teff': _num(star['koi_steff'], 0),
              'srad': _num(star['koi_srad'], 3), 'kepmag': _num(star['koi_kepmag'], 2),
              'ra': round(float(star['ra']), 5), 'dec': round(float(star['dec']), 5)}
    detail.update(star_facts(star, extras, gaia_row))
    if extras is not None and len(extras):
        detail['host'] = str(extras['hostname'].iloc[0])   # NASA's name, for its overview page
    detail['planets'] = planets
    return detail


def habitable_zone(detail):
    """(inner, outer) AU, same approximation as the page: L = R^2 (T/5772)^4, 1.1 and 0.36 x Earth's sunlight."""
    if detail.get('teff') is None or detail.get('srad') is None:
        return None
    lum = detail['srad'] ** 2 * (detail['teff'] / 5772) ** 4
    return (lum / 1.1) ** 0.5, (lum / 0.36) ** 0.5


def counts_as_planet(p):
    """Confirmed or other-method planets, and candidates Star Gazer calls planets."""
    return p['status'] != 'candidate' or p.get('sg_planet') is True


def tags(detail, drawn):
    planets = [p for p in detail['planets'] if counts_as_planet(p)]
    hz = habitable_zone(detail)
    bits = 0
    if hz and any(hz[0] <= p['sma'] <= hz[1] for p in planets):
        bits |= TAGS['hz']
    if any(p.get('radius') is not None and 0.7 <= p['radius'] <= 1.5 for p in planets):
        bits |= TAGS['earth']
    if len(planets) >= 5:
        bits |= TAGS['multi']
    if any(p.get('radius') is not None and p['radius'] >= 6 for p in planets):
        bits |= TAGS['giant']
    if any(p.get('toi') for p in detail['planets']):
        bits |= TAGS['tess']
    if not drawn:
        bits |= TAGS['unscored']
    return bits


def chunk_of(name):
    """Which details file holds this system (stable across exports)."""
    return int(hashlib.sha1(name.encode()).hexdigest()[:8], 16) % CHUNKS


def red_flags(p):
    """Plain-language reasons a candidate might not be a planet."""
    flags = list(p.get('flags', []))
    if p.get('snr') is not None and p['snr'] < 10:
        flags.append('weak signal')
    if p.get('radius') is not None and p['radius'] > 20:
        flags.append('too big for a planet')
    if p.get('nasa') is not None and p['nasa'] < 0.5:
        flags.append("NASA's vetting score is low")
    return flags


def leaderboard(systems, n=15):
    """Candidates most likely to be real planets (Star Gazer and NASA's vetting score agreeing, no
    red flags), and the same for habitable-zone candidates."""
    rows = []
    for name, d in systems.items():
        hz = habitable_zone(d)
        for p in d['planets']:
            if p['status'] != 'candidate' or red_flags(p):
                continue
            votes = [v for v in (p.get('sg'), p.get('nasa')) if v is not None]
            if not votes:
                continue
            rows.append({'system': name, 'planet': p['name'], 'score': round(sum(votes) / len(votes), 3),
                         'sg': p.get('sg'), 'nasa': p.get('nasa'), 'radius': p.get('radius'),
                         'snr': p.get('snr'), 'hz': bool(hz and hz[0] <= p['sma'] <= hz[1])})
    rows.sort(key=lambda r: (-r['score'], -(r['snr'] or 0), r['planet']))   # ties: stronger signal first
    return {'top': rows[:n], 'hz': [r for r in rows if r['hz']][:n]}


def build(catalog, spotlight=SPOTLIGHT, scores=None, planets=None, threshold=0.5, tois=None, gaia=None):
    """Map pixels for every star with a non-false-positive KOI, full detail for drawn systems.
    Optional extras: `planets` is NASA's confirmed-planet table (masses, distances, non-KOI planets),
    `tois` NASA's TESS Objects of Interest table, `gaia` {kepid: Berger et al. 2020 star row}."""
    scores, gaia = scores or {}, gaia or {}
    kois = catalog[catalog['koi_disposition'].isin(list(STATUS))]
    kois = kois.dropna(subset=['ra', 'dec', 'koi_period'])
    positions = kois.groupby('kepid', as_index=False)[['ra', 'dec']].first()
    hosts = match_hosts(positions, planets)
    tess = match_hosts(positions, tois, key='tid')
    stars, systems = [], {}
    wanted = set(spotlight)
    for kepid, rows in kois.groupby('kepid', sort=True):
        name = system_name(rows)
        cand = rows[rows['koi_disposition'] == 'CANDIDATE']['kepoi_name']
        cand_scores = [scores[k][0] for k in cand if k in scores]
        drawn = bool((rows['koi_disposition'] == 'CONFIRMED').any() or cand_scores)
        detail = system_detail(rows, scores, hosts.get(int(kepid)), gaia.get(int(kepid)), tess.get(int(kepid)))
        systems[name] = detail
        mag = rows['koi_kepmag'].iloc[0]
        stars.append([name, int(kepid), koi_host(rows['kepoi_name'].iloc[0]),
                      round(float(rows['ra'].iloc[0]), 4), round(float(rows['dec'].iloc[0]), 4),
                      None if pd.isna(mag) else round(float(mag), 1), int(name in wanted), int(drawn),
                      len(rows), round(max(cand_scores), 3) if cand_scores else None,
                      len(detail['planets']), sum(p['status'] == 'confirmed' for p in detail['planets']),
                      tags(detail, drawn), chunk_of(name)])
    names = {s[0] for s in stars}
    missing = sorted(wanted - names)
    return {'source': 'NASA Exoplanet Archive (KOI, confirmed-planet and TOI tables); '
                      'Berger et al. 2020 (Gaia-Kepler stellar properties)',
            'exported': datetime.now(timezone.utc).date().isoformat(),
            'scored': bool(scores), 'sg_threshold': threshold,
            'columns': COLUMNS, 'tags': TAGS, 'chunks': CHUNKS,
            'spotlight': [n for n in spotlight if n in names],
            'leaderboard': leaderboard(systems), 'stars': stars, 'systems': systems}, missing


def _json(obj):
    return json.dumps(obj, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def to_js(data):
    """The index file: everything except the per-system details."""
    index = {k: v for k, v in data.items() if k != 'systems'}
    return ('// Generated by scripts/export_starmap.py from the NASA Exoplanet Archive. Do not edit.\n'
            f'window.STARMAP = {_json(index)};\n')


def chunk_files(data):
    """{chunk number: file text} for the per-system details (loaded on demand by the page)."""
    col = {c: i for i, c in enumerate(data['columns'])}
    groups = {k: {} for k in range(data['chunks'])}
    for star in data['stars']:
        groups[star[col['chunk']]][star[col['name']]] = data['systems'][star[col['name']]]
    return {k: ('// Generated by scripts/export_starmap.py. Do not edit.\n'
                f'window.STARMAP_DETAILS({k},{_json(v)});\n') for k, v in groups.items()}


def write_outputs(data, out):
    """Write the index to `out` and the details to out.parent/details/NN.js; returns sizes."""
    out.parent.mkdir(parents=True, exist_ok=True)
    index = to_js(data)
    out.write_text(index, encoding='utf-8')
    details = out.parent / 'details'
    details.mkdir(exist_ok=True)
    for old in details.glob('*.js'):
        old.unlink()
    sizes = []
    for k, text in chunk_files(data).items():
        (details / f'{k:02d}.js').write_text(text, encoding='utf-8')
        sizes.append(len(text.encode('utf-8')))
    return len(index.encode('utf-8')), sizes


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
    threshold_file = THRESHOLD
    if not scores and args.scores == SCORES and PUBLIC_SCORES.exists():
        scores, threshold_file = load_scores(PUBLIC_SCORES), PUBLIC_SCORES.with_suffix('.json')
        print(f'Using the public scores in {C.rel(PUBLIC_SCORES)}')
    planets = load_planets(args.planets, download=not args.offline)
    tois = load_tois(download=not args.offline)
    gaia = load_gaia()
    threshold = json.loads(threshold_file.read_text())['threshold'] if scores and threshold_file.exists() else 0.5
    data, missing = build(catalog, scores=scores, planets=planets, threshold=threshold, tois=tois, gaia=gaia)
    if missing:
        print(f'Warning: spotlight systems not in the catalog: {", ".join(missing)}')
    size, chunk_sizes = write_outputs(data, args.out)
    n_drawn = sum(s[COLUMNS.index('drawn')] for s in data['stars'])
    print(f'Saved {C.rel(args.out)}: {len(data["stars"])} stars ({n_drawn} drawn, the rest unconfirmed), '
          f'{len(scores)} Star Gazer scores, index {size / 1024:.0f} KB + {len(chunk_sizes)} detail files '
          f'({sum(chunk_sizes) / 1024:.0f} KB, largest {max(chunk_sizes) / 1024:.0f} KB)')
    if size > MAX_BYTES or max(chunk_sizes) > CHUNK_MAX_BYTES:
        print('Warning: over the size budget; raise CHUNKS or trim fields.')
    if args.out == OUT_FILE:   # keep the social preview image in step with the published data
        import make_og_image
        make_og_image.main()


if __name__ == '__main__':
    main()
