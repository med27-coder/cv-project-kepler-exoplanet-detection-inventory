"""Check that NASA's tables still have every column this project reads (weekly in CI).

    .venv\\Scripts\\python scripts\\check_nasa_schema.py

Asks the NASA Exoplanet Archive TAP service for one row of each table with exactly the columns
the pipeline and the star map use. If NASA renames or drops one, this fails with the column
names, long before a monthly refresh or a rebuild breaks in a confusing way.
"""

import sys
import urllib.parse
import urllib.request

TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'
TABLES = {
    'cumulative': ['kepid', 'kepoi_name', 'kepler_name', 'koi_disposition', 'koi_pdisposition', 'koi_score',
                   'koi_period', 'koi_time0bk', 'koi_duration', 'koi_depth', 'koi_prad', 'koi_teq', 'koi_insol',
                   'koi_sma', 'koi_model_snr', 'koi_steff', 'koi_srad', 'koi_smass', 'koi_slogg', 'koi_smet',
                   'koi_kepmag', 'koi_fpflag_nt', 'koi_fpflag_ss', 'koi_fpflag_co', 'koi_fpflag_ec', 'ra', 'dec'],
    'pscomppars': ['pl_name', 'hostname', 'ra', 'dec', 'discoverymethod', 'disc_year', 'sy_dist', 'pl_bmasse',
                   'pl_bmassprov', 'pl_orbper', 'pl_orbsmax', 'pl_rade', 'pl_eqt', 'pl_orbeccen', 'pl_orblper',
                   'pl_insol', 'sy_snum', 'st_spectype'],
    'toi': ['toi', 'tid', 'ra', 'dec', 'pl_orbper', 'tfopwg_disp'],
}


def check(table, columns):
    query = f'select top 1 {",".join(columns)} from {table}'
    url = f'{TAP}?{urllib.parse.urlencode({"query": query, "format": "csv"})}'
    with urllib.request.urlopen(url, timeout=120) as r:   # fixed https host
        text = r.read().decode('utf-8', errors='replace')
    header = text.splitlines()[0] if text else ''
    missing = [c for c in columns if c not in header.split(',')]
    return missing, text if missing else ''


def main():
    failed = False
    for table, columns in TABLES.items():
        try:
            missing, body = check(table, columns)
        except OSError as e:
            sys.exit(f'Could not reach the NASA Exoplanet Archive: {e}')
        if missing:
            failed = True
            print(f'✖ {table}: missing {missing}\n  {body[:300]}')
        else:
            print(f'✔ {table}: all {len(columns)} columns present')
    if failed:
        sys.exit('NASA changed a table this project reads; update the export / pipeline.')


if __name__ == '__main__':
    main()
