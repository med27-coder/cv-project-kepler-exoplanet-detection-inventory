---
description: Release a new version of the Kepler Star Map (version bump, changelog, tests, push, tag, GitHub Release)
argument-hint: "[what changed, in a few words]"
---

Release a new version of the star map, following the release convention in CLAUDE.md. Arguments: $ARGUMENTS
(they describe what changed). Versions count up one step in the last number per release (1.9.1, 1.9.2, 1.9.3...), so
they always read in order for players; never jump to 2.0.

1. Read `web/src/00-version.js` and the top of `CHANGELOG.md`; the new version is the last one with its final number + 1.
2. Look at the commits since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`) and the
   working tree, and summarise what changed for players, in plain words, no spoilers for secret easter eggs.
3. Add the new version at the top of `HISTORY` in `web/src/00-version.js` (it sets VERSION and the antenna's WHAT'S
   NEW): date and 1 to 3 player-facing notes starting "New:" or "Fixed:", no spoilers, no technical or security
   details. Use double quotes for any note containing an apostrophe.
4. Add the `## [X.Y.Z] - <today>` entry to `CHANGELOG.md` (Added / Changed / Fixed) and its link at the bottom.
5. Run `.venv/Scripts/python scripts/starmap/build_web.py`, then `--check`, `node --check web/starmap.js`,
   `.venv/Scripts/python -m ruff check .` and the full test suite (`.venv/Scripts/python -m pytest -q`). If anything
   fails, stop and fix it before going on.
6. Commit with a message starting `vX.Y.Z`, push, and wait for the CI `tests` run (`gh run watch`). If it fails,
   stop and report.
7. Tag (`git tag -a vX.Y.Z <commit> -m "Kepler Star Map vX.Y.Z"`), push the tag, and publish the release with the
   changelog entry as its notes (`gh release create vX.Y.Z --verify-tag --title ... --notes-file ...`).
8. Report the version, the release link, and what the antenna will now announce.
