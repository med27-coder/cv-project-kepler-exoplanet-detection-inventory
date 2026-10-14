"""Where humanity's spacecraft are: positions for the star map's Solar System easter egg.

    .venv\\Scripts\\python scripts\\starmap\\fetch_spacecraft.py             # positions for today
    .venv\\Scripts\\python scripts\\starmap\\fetch_spacecraft.py --date 2026-10-13

Asks NASA JPL's Horizons system (the ephemeris service NASA uses for spacecraft navigation) for
the heliocentric position of the planets and of spacecraft beyond Earth orbit, and writes
web/data/spacecraft.js (loaded by the page only when the easter egg is opened). Satellites
orbiting Earth are left out on purpose; the ISS has its own easter egg. A spacecraft Horizons
has no position for on that date (mission over, ephemeris not published) is skipped and
reported, never guessed. The Mars rovers are fixed landing sites (NASA mission pages).
"""

import argparse
import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'web' / 'data' / 'spacecraft.js'
HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
LIGHT_MIN_PER_AU = 8.3167

PLANETS = {'Mercury': '199', 'Venus': '299', 'Earth': '399', 'Mars': '499',
           'Jupiter': '599', 'Saturn': '699', 'Uranus': '799', 'Neptune': '899',
           'Pluto': '999'}   # dwarf planet, drawn with the planets
NASA = 'https://science.nasa.gov/mission/'
ESA = 'https://www.esa.int/Science_Exploration/Space_Science/'
# Horizons id, short label for the map, agency, launch year, where it works, official page
SPACECRAFT = [
    ('-31', 'Voyager 1', 'V1', 'NASA', 1977, 'interstellar space since 2012; the farthest human-made object', NASA + 'voyager/'),
    ('-32', 'Voyager 2', 'V2', 'NASA', 1977, 'interstellar space since 2018', NASA + 'voyager/'),
    ('-98', 'New Horizons', 'NH', 'NASA', 2006, 'Kuiper Belt; flew past Pluto (2015) and Arrokoth (2019)', NASA + 'new-horizons/'),
    ('-170', 'James Webb Space Telescope', 'JWST', 'NASA/ESA/CSA', 2021, 'infrared telescope near Sun-Earth L2, 1.5 million km beyond Earth', NASA + 'webb/'),
    ('-680', 'Euclid', 'EUCLID', 'ESA', 2023, 'dark-universe telescope near Sun-Earth L2', ESA + 'Euclid'),
    ('-21', 'SOHO', 'SOHO', 'ESA/NASA', 1995, 'watches the Sun from Sun-Earth L1', NASA + 'soho/'),
    ('-96', 'Parker Solar Probe', 'PSP', 'NASA', 2018, 'flies through the Sun\'s outer atmosphere, closer than any other spacecraft', NASA + 'parker-solar-probe/'),
    ('-144', 'Solar Orbiter', 'SOLO', 'ESA/NASA', 2020, 'studies the Sun, including its poles', NASA + 'solar-orbiter/'),
    ('-121', 'BepiColombo', 'BEPI', 'ESA/JAXA', 2018, 'on its way to orbit Mercury', ESA + 'BepiColombo'),
    ('-61', 'Juno', 'JUNO', 'NASA', 2011, 'orbiting Jupiter since 2016', NASA + 'juno/'),
    ('-159', 'Europa Clipper', 'CLIPPER', 'NASA', 2024, 'on its way to Jupiter\'s moon Europa', NASA + 'europa-clipper/'),
    ('-28', 'JUICE', 'JUICE', 'ESA', 2023, 'on its way to Jupiter\'s icy moons', ESA + 'Juice'),
    ('-49', 'Lucy', 'LUCY', 'NASA', 2021, 'touring the Trojan asteroids that share Jupiter\'s orbit', NASA + 'lucy/'),
    ('-255', 'Psyche', 'PSYCHE', 'NASA', 2023, 'on its way to the metal-rich asteroid Psyche', NASA + 'psyche/'),
    ('-64', 'OSIRIS-APEX', 'APEX', 'NASA', 2016, 'on its way to asteroid Apophis (after returning a Bennu sample as OSIRIS-REx)', NASA + 'osiris-apex/'),
    ('-74', 'Mars Reconnaissance Orbiter', 'MRO', 'NASA', 2005, 'orbiting Mars', NASA + 'mars-reconnaissance-orbiter/'),
    ('-53', 'Mars Odyssey', 'ODYSSEY', 'NASA', 2001, 'orbiting Mars', NASA + 'odyssey/'),
    ('-41', 'Mars Express', 'MEX', 'ESA', 2003, 'orbiting Mars', ESA + 'Mars_Express'),
    ('-143', 'ExoMars Trace Gas Orbiter', 'TGO', 'ESA/Roscosmos', 2016, 'orbiting Mars', ESA + 'ExoMars'),
]
ROVERS = [
    {'name': 'Curiosity', 'agency': 'NASA', 'landed': '2012-08-06', 'site': 'Gale Crater',
     'url': NASA + 'msl-curiosity/'},
    {'name': 'Perseverance', 'agency': 'NASA', 'landed': '2021-02-18', 'site': 'Jezero Crater',
     'note': 'brought the Ingenuity helicopter, which made 72 flights', 'url': NASA + 'mars-2020-perseverance/'},
]


def position(target, day):
    """Heliocentric ecliptic (x, y, z) in AU on `day`, or None if Horizons has no ephemeris."""
    q = {'format': 'json', 'COMMAND': f"'{target}'", 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES',
         'EPHEM_TYPE': 'VECTORS', 'CENTER': "'500@10'", 'REF_PLANE': 'ECLIPTIC',
         'START_TIME': f"'{day}'", 'STOP_TIME': f"'{day + timedelta(days=1)}'", 'STEP_SIZE': "'1 d'",
         'VEC_TABLE': '1', 'OUT_UNITS': 'AU-D', 'CSV_FORMAT': 'YES'}
    with urllib.request.urlopen(f'{HORIZONS}?{urllib.parse.urlencode(q)}', timeout=60) as r:   # fixed https host
        result = json.load(r).get('result', '')
    if '$$SOE' not in result:
        return None
    row = result.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()[0].split(',')
    return tuple(round(float(v), 5) for v in row[2:5])


def describe(xyz, earth):
    r = math.dist(xyz, (0, 0, 0))
    d = math.dist(xyz, earth)
    return {'xyz': list(xyz), 'r_au': round(r, 3), 'lon': round(math.degrees(math.atan2(xyz[1], xyz[0])) % 360, 2),
            'earth_au': round(d, 4), 'light_min': round(d * LIGHT_MIN_PER_AU, 1)}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--date', type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    args = parser.parse_args()
    try:
        planets = {name: position(code, args.date) for name, code in PLANETS.items()}
    except OSError as e:
        sys.exit(f'Could not reach JPL Horizons: {e}')
    earth = planets['Earth']
    out = {'date': args.date.isoformat(), 'source': 'NASA JPL Horizons (heliocentric, ecliptic J2000)',
           'planets': {n: describe(p, earth) for n, p in planets.items()}, 'spacecraft': [], 'rovers': ROVERS}
    skipped = []
    for code, name, label, agency, launched, where, url in SPACECRAFT:
        xyz = position(code, args.date)
        if xyz is None:
            skipped.append(name)
            continue
        out['spacecraft'].append({'name': name, 'label': label, 'agency': agency, 'launched': launched,
                                  'where': where, 'url': url, **describe(xyz, earth)})
    OUT.write_text('// Generated by scripts/starmap/fetch_spacecraft.py from NASA JPL Horizons. Do not edit.\n'
                   f'window.STARMAP_SPACECRAFT = {json.dumps(out, separators=(",", ":"))};\n', encoding='utf-8')
    print(f'Saved {OUT.relative_to(ROOT)}: {len(out["spacecraft"])} spacecraft on {args.date}'
          + (f'; no ephemeris (skipped): {", ".join(skipped)}' if skipped else ''))


if __name__ == '__main__':
    main()
