# Hand-off notes

Where the project stands and how to pick it up, for anyone (or any session) continuing the work. Updated
18 October 2026. The detailed rules live in [CLAUDE.md](../CLAUDE.md); the plans in [plans/README.md](plans/README.md).

## State

- **Kepler Star Map** (`web/`, live on GitHub Pages): version **1.9.10**. Every version is in
  [CHANGELOG.md](../CHANGELOG.md), tagged and published as a GitHub Release; players see the same history, in plain
  words, in the antenna's UPDATES tab (`HISTORY` in `web/src/00-version.js`).
- **The game:** 38 easter eggs (Hubble in 1.9.3, the Hail Mary at Tau Ceti in 1.9.4, Zhurong in 1.9.8, the Moon rovers in
  1.9.9), 81 achievements, sky events (comets, asteroids, a rare UFO; meteors to catch from the ISS), animated scenes for the
  rovers (Sojourner, Spirit, Opportunity, Curiosity, Perseverance, Zhurong; Lunokhod 1 and Yutu-2 on the Moon), the Martian farm, the dwarf planets, the
  lost astronaut's wardrobe, fun facts on every Galleria card.
- **Star Gazer** (the model): **V3** stays. Three registered attempts to beat it on giant planets failed and are
  reported as registered: Colossus, Colossus 2, V3.1 ([star-gazer/V3_1_RESULTS.md](star-gazer/V3_1_RESULTS.md)).
  Colossus 2 is shown on the map as an EXPERIMENTAL second opinion on giant candidates only.
  Any new attempt needs its own pre-registration first, judged on folds not yet used.
- **Tests:** about 150 (pytest + Playwright); CI runs them with ruff, mypy, the web build check and `node --check`.

## Conventions that matter

- **Versions count up in the last number** (1.9.1, 1.9.2, 1.9.3...), never 2.0. `/release <what changed>` does the
  whole routine (history, changelog, checks, push, CI, tag, GitHub Release).
- **Player-facing notes** say only "New:" and "Fixed:"; no spoilers for hidden eggs, no technical or security details.
- **Never hand-edit** `web/starmap.js` (built from `web/src/`) or `web/data/` (generated). Shipped achievement and
  egg ids never change (`SHIPPED_IDS` in `tests/test_web_data.py`); every egg needs fun facts (`48c-egg-facts.js`).
- **Pixel art that is replaced or dropped** is copied to `pixel-art/archive/` first, with a row saying why.
- **Licences:** NASA images are copied as references; ESA images are linked only; no film stills.
- **No emojis** in the README or docs; the search box drops them too.

## Safety rails (Claude Code)

- The Star Gazer key (`.secrets/star_gazer.key`) is never committed: `.gitignore`, a Claude Code hook
  (`.claude/hooks/guard_secrets.py`), a git pre-commit hook (`precommit_secrets.py --install` once per clone) and a
  CI test (`tests/test_repo_hygiene.py`). **Back the key up outside the repo** (password manager + offline copy).
- `check_web.py` rebuilds and syntax-checks the site after every edit in `web/src/`.

## Open decisions and next steps

- Decided 18 October 2026 and built: meteors both ways and the Moon rovers (1.9.9); Colossus beside Star Gazer,
  labelled EXPERIMENTAL (1.9.10): `star gazer` / `colossus` pages and a score switch in giant candidates' case files
  (scores from `scripts/pipeline/colossus_score_candidates.py`, explained in star-gazer/V4B_RESULTS.md).
- Commit identity (only the med27-coder account): see [plans/COMMIT_IDENTITY.md](plans/COMMIT_IDENTITY.md).
- The loop's work list: [plans/LOOP_BACKLOG.md](plans/LOOP_BACKLOG.md).
