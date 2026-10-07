"""Terms of Use acceptance gate.

Acceptance is recorded in `.terms_accepted` at the repo root (git-ignored),
tagged with TERMS_VERSION. Bumping the version forces everyone to re-accept.

Ways to accept:
  * notebook:  require_acceptance(accept=True)
  * CLI/app:   interactive y/N prompt
  * CI/batch:  environment variable KEPLER_ACCEPT_TERMS=1
"""

import getpass
import json
import os
import sys
from datetime import datetime, timezone

from .config import TERMS_FILE, TERMS_RECORD

TERMS_VERSION = '1.0'
ENV_VAR = 'KEPLER_ACCEPT_TERMS'

_accepted = False


class TermsNotAcceptedError(RuntimeError):
    pass


def _record_is_current():
    try:
        record = json.loads(TERMS_RECORD.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return False
    return record.get('version') == TERMS_VERSION


def _write_record(method):
    record = {
        'version': TERMS_VERSION,
        'accepted_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'user': getpass.getuser(),
        'method': method,
    }
    TERMS_RECORD.write_text(json.dumps(record, indent=2), encoding='utf-8')


def summary():
    return (
        f'Kepler Exoplanet Detection, Terms of Use v{TERMS_VERSION}\n'
        '  - Educational / non-commercial research use only.\n'
        '  - Model output is NOT a scientific classification; do not cite it as one.\n'
        '  - Provided "as is", with no warranty.\n'
        '  - Use NASA / MAST services responsibly and credit them.\n'
        f'Full text: {TERMS_FILE}'
    )


def is_accepted():
    global _accepted
    if not _accepted:
        _accepted = _record_is_current()
    return _accepted


def require_acceptance(accept=False, interactive=None):
    """Make sure the current user has accepted the Terms of Use.

    accept=True records acceptance (use it in the notebook after reading the
    terms). Otherwise falls back to the env var, then an interactive prompt
    when running in a terminal. Raises TermsNotAcceptedError if none apply.
    """
    global _accepted
    if is_accepted():
        return True

    if accept:
        method = 'explicit'
    elif os.environ.get(ENV_VAR, '').strip().lower() in ('1', 'true', 'yes'):
        method = 'environment'
    else:
        if interactive is None:
            interactive = sys.stdin is not None and sys.stdin.isatty()
        if not interactive:
            raise TermsNotAcceptedError(
                'You must accept the Terms of Use before running this project.\n\n'
                + summary()
                + '\n\nIn the notebook: set ACCEPT_TERMS = True in the Terms cell.'
                f'\nIn a terminal: answer the prompt, or set {ENV_VAR}=1.'
            )
        print(summary())
        try:
            answer = input('\nDo you accept the Terms of Use? [y/N] ').strip().lower()
        except EOFError:
            answer = ''
        if answer not in ('y', 'yes'):
            raise TermsNotAcceptedError('Terms of Use declined.')
        method = 'prompt'

    _write_record(method)
    _accepted = True
    print(f'Terms of Use v{TERMS_VERSION} accepted.')
    return True


def ensure_accepted():
    """Guard for functions that hit NASA services or train/run the model."""
    if not is_accepted():
        raise TermsNotAcceptedError(
            'Terms of Use not accepted yet. Run kepler_cnn.terms.require_acceptance() first.\n\n'
            + summary()
        )
