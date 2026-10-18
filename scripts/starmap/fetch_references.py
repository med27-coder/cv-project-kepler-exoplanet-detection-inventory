"""Download the official reference images the pixel art was drawn from (pixel-art/references/).

    .venv\\Scripts\\python scripts\\starmap\\fetch_references.py

Every image comes from the NASA Image and Video Library (images.nasa.gov), picked by its NASA ID,
and is shrunk to at most 640 pixels wide. NASA media is generally not under copyright in the United
States (https://www.nasa.gov/nasa-brand-center/images-and-media/). Images whose record credits ESA
(Euclid, Mars Express, Solar Orbiter, SOHO, ExoMars) fall under ESA's own licence terms, so they are
only linked in SOURCES.md, not copied into this public repository. JUICE and BepiColombo (ESA) have no picture in NASA's
library, so their sprites follow ESA's published designs and no copy is kept here.

The star map's Galleria shows the real thing next to the pixel art, so smaller copies (480 pixels wide)
also go to web/gallery/, with their credits in web/data/gallery.js.
"""

import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'pixel-art' / 'references'
API = 'https://images-api.nasa.gov'
MAX_W = 640
WEB = ROOT / 'web' / 'gallery'
WEB_W = 480   # twice the 240 pixels they're shown at, so they stay sharp on high-density screens
CREDITS = ROOT / 'web' / 'data' / 'gallery.js'

# (folder, file name, NASA ID, what it shows)
PICKS = [
    ('spacecraft', 'kepler', 'PIA11825', 'Kepler, artist concept'),
    ('spacecraft', 'jwst', 'GSFC_20171208_Archive_e000355', 'Webb: the real mirror and sunshield, in the clean room'),
    ('spacecraft', 'voyager', 'PIA17049', 'Voyager, artist concept'),
    ('spacecraft', 'new-horizons', 'PIA21943', 'New Horizons at Arrokoth, artist concept'),
    ('spacecraft', 'parker-solar-probe', 'KSC-20180419-PH_KLS01_0009', 'Parker Solar Probe before launch'),
    ('spacecraft', 'juno', 'PIA13746', 'Juno, artist concept'),
    ('spacecraft', 'europa-clipper', 'PIA26433', 'Europa Clipper, artist concept'),
    ('spacecraft', 'soho', 'PIA18170', 'SOHO, artist concept'),
    ('spacecraft', 'euclid', 'PIA16692', 'Euclid, artist concept'),
    ('spacecraft', 'solar-orbiter', 'KSC-20200108-PH-ESA01_0001', 'Solar Orbiter before launch'),
    ('spacecraft', 'lucy', 'KSC-20210929-PH-JBS01_0051', 'Lucy before launch (arrays folded)'),
    ('spacecraft', 'psyche', 'PIA23875', 'Psyche, artist concept'),
    ('spacecraft', 'osiris-apex', 'GSFC_20171208_Archive_e000397', 'OSIRIS-REx (now OSIRIS-APEX) in testing'),
    ('spacecraft', 'mars-reconnaissance-orbiter', 'PIA04758', 'Mars Reconnaissance Orbiter, artist concept'),
    ('spacecraft', 'mars-odyssey', 'PIA04244', 'Mars Odyssey, artist concept'),
    ('spacecraft', 'mars-express', 'PIA04802', 'Mars Express, artist concept'),
    ('spacecraft', 'trace-gas-orbiter', 'PIA21139', 'ExoMars Trace Gas Orbiter, artist concept'),
    ('spacecraft', 'curiosity', 'PIA19808', 'Curiosity selfie on Mars'),
    ('spacecraft', 'perseverance', 'PIA24542', 'Perseverance selfie with Ingenuity'),
    ('spacecraft', 'iss', 'iss056e201248', 'The ISS photographed from a departing Soyuz (2018)'),
    # Real photos in natural colour where one exists (not artist montages or false-colour ultraviolet).
    ('solar-system', 'pale-blue-dot', 'PIA23645', ('The "Pale Blue Dot": Earth as a speck in a sunbeam (right of centre), '
                                                   'photographed by Voyager 1 from 6 billion km in 1990 (reprocessed 2020)')),
    ('solar-system', 'sun', 'GSFC_20171208_Archive_e000923', 'The Sun in visible light with a giant sunspot (SDO, 2014)'),
    ('solar-system', 'mercury', 'PIA02418', 'Mercury, most of a hemisphere, as Mariner 10 left it (1974)'),
    ('solar-system', 'venus', 'PIA23791', 'Venus and its clouds (Mariner 10, 1974, reprocessed)'),
    ('solar-system', 'earth', 'epic-view-of-africa-and-europe-from-a-million-miles-away_19927967400_o',
     'Earth, Africa and Europe, from 1.5 million km (DSCOVR EPIC, 2015)'),
    ('solar-system', 'moon', 'GSFC_20171208_Archive_e000868', 'The full Moon'),
    ('solar-system', 'mars', 'PIA04304', 'Mars, a global colour mosaic from the Viking orbiters'),
    ('solar-system', 'jupiter', 'PIA04866', 'Jupiter and the Great Red Spot (Cassini, 2000)'),
    ('solar-system', 'saturn', 'PIA14922', 'Saturn with its moon Titan in front (Cassini, 2012)'),
    ('solar-system', 'uranus', 'PIA18182', 'Uranus (Voyager 2, 1986)'),
    ('solar-system', 'neptune', 'PIA01492', 'Neptune and its Great Dark Spot (Voyager 2, 1989)'),
    ('solar-system', 'pluto', 'PIA19952', 'Pluto by New Horizons (enhanced colour), heart and all'),
    ('solar-system', 'ceres', 'PIA21906', 'Ceres from NASA\'s Dawn spacecraft (2017)'),
    ('solar-system', 'eris', 'PIA17307', 'Eris and its moon Dysnomia (artist concept: no spacecraft has visited)'),
    # A star's life, for the rank emblems (docs/star-map/STAR_GAZER_MISSION.md); concept references, not on the site yet.
    ('stars', '1-nebula', 'PIA03515', 'Stellar nursery: dust pillars in the Carina Nebula (Spitzer, infrared)'),
    ('stars', '2-protostar', 'PIA18928', 'A protostar flaring as it grows, in Orion (Spitzer)'),
    ('stars', '4-red-giant', 'PIA09070', 'Mira, a red giant shedding a 13-light-year tail (GALEX ultraviolet)'),
    ('stars', '5-planetary-nebula', 'PIA15817', "The Helix: a Sun-like star's cast-off layers (Spitzer)"),
    ('stars', '6-white-dwarf', 'PIA22084', 'A white dwarf, what the Sun will become (artist concept)'),
    ('stars', '7-supernova', 'PIA06908', "Kepler's Supernova Remnant: the star Johannes Kepler saw explode in 1604 (Chandra)"),
    ('stars', '8-neutron-star', 'PIA21085', 'A pulsar: a spinning neutron star sweeping beams (artist concept)'),
    ('stars', '9-black-hole', 'PIA16695', 'A black hole with its glowing disk and jet (artist concept)'),
    ('concepts', 'comet-neowise', 'NHQ202007120001', 'Comet NEOWISE over Washington, July 2020 (for the passing comets)'),
    ('concepts', 'comet-hale-bopp', 'PIA01289', 'Comet Hale-Bopp seen by Hubble (for the passing comets)'),
    ('concepts', 'asteroid-eros', 'PIA02900', 'Asteroid Eros up close, NEAR Shoemaker (for the passing asteroids)'),
    ('stars', '9-black-hole-m87', 'PIA23122', 'Galaxy M87 (Spitzer) with the first image of a black hole (Event Horizon Telescope inset)'),
    # The Martian easter egg (a fan reference to Andy Weir's novel and the 2015 film): real NASA work on farming Mars.
    # No film stills (the studio's copyright); these are NASA's own pictures, shown as references in the Galleria.
    ('martian', 'martian-gardens', 'KSC-20160815-PH_DNG01_0003', "Martian Gardens: crops grown in simulated Martian soil (NASA Kennedy and Florida Tech, 2016)"),
    ('martian', 'mars-habitat', 'PIA23302', 'First humans on Mars: astronauts and habitats (artist concept)'),
    ('martian', 'mars-greenhouse', 'PIA23343', 'Aerogel greenhouses: a proposal for warming patches of Mars to grow plants (concept)'),
    ('martian', 'acidalia', 'PIA02000', 'Acidalia and Chryse Plains, where the novel puts the Ares 3 base (Mars Global Surveyor)'),
    ('martian', 'pathfinder', 'PIA00621', 'Mars Pathfinder and Sojourner in 1997, the lander the story uses to phone home'),
    ('martian', 'veggie', 'KSC-20171017-PH_ISS01_0001', "Lettuce and mustard greens growing in Veggie, the space station's plant chamber: a real greenhouse in space (2017)"),
    # Trophies (docs/plans/TROPHIES_AND_DATA.md): the universe cup, the nebula tier, and unique trophies.
    ('trophies', 'universe-deep-field', 'GSFC_20171208_Archive_e001651', 'Hubble eXtreme Deep Field: thousands of galaxies in a speck of sky'),
    ('trophies', 'universe-cmb', 'PIA16874', 'The oldest light in the universe, the cosmic microwave background (Planck)'),
    ('trophies', 'universe-baby-galaxies', 'PIA07142', 'Young galaxies across the universe (GALEX, Spitzer)'),
    ('trophies', 'universe-milky-way', 'PIA10748', 'Our Milky Way from outside, with its central bar (artist concept)'),
    ('trophies', 'universe-andromeda', 'PIA04921', 'The Andromeda galaxy in ultraviolet (GALEX)'),
    ('trophies', 'nebula-eagle', 'PIA25433', 'The Eagle Nebula, home of the Pillars of Creation (WISE, infrared)'),
    ('trophies', 'dwarf-ceres', 'PIA19167', 'Ceres from the Dawn spacecraft, 2015'),
    ('trophies', 'dwarf-eris', 'PIA17307', 'Eris and its moon Dysnomia (artist concept)'),
    ('trophies', 'moon-ida-dactyl', 'PIA00069', 'Asteroid Ida and its moon Dactyl, the first asteroid moon found (Galileo, 1993)'),
    ('trophies', 'red-dwarf-flare', 'GSFC_20171208_Archive_e002073', 'A red dwarf unleashing a giant flare (artist concept)'),
    ('trophies', 'red-dwarf-trappist', 'PIA22096', 'TRAPPIST-1, a red dwarf and its seven worlds, to scale with Jupiter\'s moons'),
    ('trophies', 'brown-dwarf', 'PIA21752', 'A brown dwarf, too small to be a star, with banded weather (artist concept)'),
    ('trophies', 'two-suns-kepler-16', 'PIA14724', 'Kepler-16 b, where the sun sets twice (artist concept)'),
]
# Part of the picture to keep, as fractions (left, top, right, bottom): NASA's Venus is a pair, the plain view on the
# left and a contrast-enhanced copy on the right.
CROP = {'venus': (0, 0, 0.49, 1)}
WEB_FOLDERS = {'spacecraft', 'solar-system', 'martian'}   # the Galleria's photos; 'stars' are concept references only
EXTRA = [   # not in the NASA library search: (folder, file, URL, credit, what it shows)
    ('solar-system', 'earth-blue-marble',
     'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg',
     'NASA Goddard Space Flight Center / Visible Earth', 'Blue Marble map, the source of the pixel Earth'),
]


def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def save_image(data, path, width=MAX_W, quality=85, crop=None):
    img = Image.open(io.BytesIO(data)).convert('RGB')
    if crop:
        img = img.crop(tuple(round(f * (img.width if k % 2 == 0 else img.height)) for k, f in enumerate(crop)))
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, quality=quality, optimize=True)


def main():
    rows, gallery = [], {}
    for folder, name, nasa_id, what in PICKS:
        meta = json.loads(get(f'{API}/search?nasa_id={urllib.parse.quote(nasa_id)}'))['collection']['items'][0]['data'][0]
        assets = [a['href'] for a in json.loads(get(f'{API}/asset/{urllib.parse.quote(nasa_id)}'))['collection']['items']]
        pick = next((a for suffix in ('~medium.jpg', '~large.jpg', '~orig.jpg') for a in assets if a.endswith(suffix)),
                    None) or next(a for a in assets if a.lower().endswith(('.jpg', '.png')))
        credit = meta.get('secondary_creator') or meta.get('photographer') or f"NASA {meta.get('center', '')}".strip()
        # Hubble images filed under GSFC name ESA only in the description's "Credit:" line (e.g. "NASA, ESA, ...").
        credit_line = re.search(r'Credits?:\s*([^<\n]{0,240})', meta.get('description', ''))
        if credit_line and re.search(r'\bESA\b', credit_line.group(1)) and 'ESA' not in credit:
            credit = f'{credit} ({credit_line.group(1).strip().rstrip(";,. ")})'
        path = OUT / folder / f'{name}.jpg'
        if 'ESA' in credit:   # ESA's licence, not NASA's: link only
            path.unlink(missing_ok=True)
            (WEB / f'{name}.jpg').unlink(missing_ok=True)
            rows.append(('(link only)', what, f"[{nasa_id}](https://images.nasa.gov/details/{nasa_id})",
                         credit, meta.get('date_created', '')[:10]))
            gallery[name] = {'img': None, 'credit': credit, 'link': f'https://images.nasa.gov/details/{nasa_id}', 'what': what}
            print(f'{name}: ESA credit, linked only')
            continue
        data = get(pick.replace('http://', 'https://'))
        save_image(data, path, crop=CROP.get(name))
        if folder not in WEB_FOLDERS:
            rows.append((f'{folder}/{name}.jpg', what, f"[{nasa_id}](https://images.nasa.gov/details/{nasa_id})",
                         credit, meta.get('date_created', '')[:10]))
            print(f'{folder}/{name}.jpg  <- {nasa_id}')
            continue
        save_image(data, WEB / f'{name}.jpg', WEB_W, 74, crop=CROP.get(name))
        gallery[name] = {'img': f'gallery/{name}.jpg', 'credit': credit,
                         'link': f'https://images.nasa.gov/details/{nasa_id}', 'what': what}
        rows.append((f'{folder}/{name}.jpg', what, f"[{nasa_id}](https://images.nasa.gov/details/{nasa_id})",
                     credit, meta.get('date_created', '')[:10]))
        print(f'{folder}/{name}.jpg  <- {nasa_id}')
    for folder, name, url, credit, what in EXTRA:
        save_image(get(url), OUT / folder / f'{name}.jpg')
        rows.append((f'{folder}/{name}.jpg', what, f'[Visible Earth]({url})', credit, ''))
        print(f'{folder}/{name}.jpg  <- {url}')
    CREDITS.write_text('// Generated by scripts/starmap/fetch_references.py. Do not edit by hand.\n'
                       f'window.STARMAP_GALLERY = {json.dumps(gallery, indent=1, ensure_ascii=False)};\n', encoding='utf-8')
    table = '\n'.join(f"| {f if f.startswith('(') else f'`{f}`'} | {w} | {s} | {c} | {d} |" for f, w, s, c, d in rows)
    (OUT / 'SOURCES.md').write_text(
        '# Reference images: sources\n\n'
        'Official images used as references for the pixel art, shrunk to at most 640 pixels wide. Made by\n'
        '`scripts/starmap/fetch_references.py`; follow each link for the full-size original and its record.\n'
        'NASA media is generally not under copyright in the United States\n'
        '([NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)); credit NASA and any\n'
        'partner named below. Using them does not imply NASA endorsement of this project. Images credited to\n'
        "ESA are under ESA's own terms, so they are linked here, not copied.\n\n"
        '| File | What it shows | Source | Credit | Date |\n|---|---|---|---|---|\n' + table + '\n\n'
        'JUICE and BepiColombo (ESA) have no image in the NASA library; their sprites follow ESA\'s published\n'
        'designs ([JUICE](https://www.esa.int/Science_Exploration/Space_Science/Juice),\n'
        '[BepiColombo](https://www.esa.int/Science_Exploration/Space_Science/BepiColombo)).\n',
        encoding='utf-8')


if __name__ == '__main__':
    main()
