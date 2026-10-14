# Security Policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Instead, use GitHub's private
reporting: **Security → Report a vulnerability** on this repository, or email
franciscomed927@gmail.com with "Security" in the subject.

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a
reply within a week. This is a student project maintained by one person, so there is no bug
bounty, but credit is given in the fix's commit message if you'd like.

## What's in scope

| Part | Where | Notes |
|---|---|---|
| Kepler Star Map | `web/`, published on GitHub Pages | Static site: no server code, no accounts, no cookies |
| Star Gazer web demo | `app.py`, `scripts/make_hf_space.py` | Gradio app; runs locally or on a Hugging Face Space |
| Encrypted model bundle | `secure/`, `scripts/secure_artifacts.py` | AES-256-GCM; the key is never committed |
| CI workflows | `.github/workflows/` | |

Out of scope: the NASA, MAST and CDS services the project downloads from, and the accuracy of
model predictions (an educational model, not a scientific classification; see
[TERMS_OF_USE.md](TERMS_OF_USE.md)).

## Measures in place

**Star map (web/)**
- Strict Content Security Policy: only the site's own scripts, styles and fonts load; no inline
  scripts, inline styles or `eval`. Images may also come from the CDS sky-survey service.
- Every value written into the page is escaped; search input is length-limited; malformed links
  are ignored.
- Clickjacking guard: GitHub Pages can't send `frame-ancestors` headers, so when another site
  frames the page it shows only a link that opens the real page.
- Fonts are self-hosted, so no third party sees visitors' requests. The only outside request is
  the optional sky photo, fetched from CDS; the 14 featured systems' photos ship with the site. No cookies, analytics or storage.
- Tests (`tests/test_web_data.py`) fail if the policy is loosened or inline code comes back,
  and validate the published data file.

**Web demo (app.py)**
- KOI names are checked against the NASA catalog before they reach a file path; manual inputs
  must be finite and in range.
- One prediction at a time with a short queue, no direct API access around the queue, and no
  error tracebacks shown to visitors. Listens on localhost unless `--host` says otherwise.
- Models are loaded with Keras `safe_mode=True` (files with embedded Python code are refused),
  and NumPy files with `allow_pickle=False`.
- A model trained on an older data recipe is refused (`StaleModelError`).

**Secrets and the model**
- The trained model and detailed results are committed only encrypted (`secure/*.enc`,
  AES-256-GCM). The bundle is split into parts under GitHub's file limit. Each part is
  authenticated together with the bundle id, creation time, its position and the part count,
  so parts can't be swapped, dropped, reordered or mixed between bundles. `MANIFEST.json` lists
  every part's SHA-256, checked before decrypting. Extraction only writes to `models/v3` and
  `results/v3`.
- The key lives in `.secrets/` (git-ignored, owner-only file permissions) or the
  `STAR_GAZER_KEY` environment variable / Hugging Face secret, never in the repository. The key
  file can be passphrase-protected (`secure_artifacts.py protect`, scrypt). `rotate`
  re-encrypts with a new key.
- `.gitignore` blocks common secret files (`.env`, `*.key`, `*.pem`, ...). The full git
  history was scanned for leaked keys and tokens (none found, October 2026).

**Supply chain**
- GitHub Actions are pinned to commit SHAs and run with the minimum permissions they need;
  checkouts don't keep the token.
- Python dependencies are locked with SHA-256 hashes (`requirements.lock`,
  `requirements-dev.lock`, made by `scripts/lock_requirements.py`); CI installs with
  `--require-hashes`, so a tampered or swapped package file is refused.
- Dependabot opens weekly update PRs for the actions and security fixes for Python dependencies.
- `dependency-audit` checks the locked versions against the PyPA advisory database weekly.
- CodeQL scans the Python, JavaScript and workflow code on every push and weekly.
- OpenSSF Scorecard rates the repository's security practices weekly (Security tab).
- The monthly `data-refresh` workflow only opens a pull request; nothing is merged automatically.

## Repository settings (maintainer checklist)

These are GitHub settings, not files, so they're listed here to keep track of them:
- Settings → Code security: **Secret scanning** and **Push protection** on,
  **Private vulnerability reporting** on, **Dependabot alerts** and **security updates** on.
- Settings → Rules: a ruleset for `main` that blocks force pushes and deletion.
- Settings → Actions → General → Workflow permissions: allow GitHub Actions to create pull
  requests (needed by the monthly `data-refresh` workflow; leave the default token read-only).
- Account: two-factor authentication on.
- Signed commits (optional, recommended): create an SSH signing key
  (`ssh-keygen -t ed25519 -f ~/.ssh/github_signing`), add the `.pub` file on GitHub under
  Settings → SSH and GPG keys → New SSH key → type *Signing key*, then
  `git config gpg.format ssh`, `git config user.signingkey ~/.ssh/github_signing.pub` and
  `git config commit.gpgsign true`. Commits then show as *Verified*.
- Keep an offline backup of `.secrets/star_gazer.key`; without it the encrypted bundle can't be opened.
- Hugging Face Space (if deployed): start it as *Private*, set `STAR_GAZER_KEY` only as a Space
  secret (never a variable), and make it public after a look at the running app.
