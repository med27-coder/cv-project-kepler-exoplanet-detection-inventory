# Planner: what's next for the star map

Plans waiting to be built, in the suggested order. Each file has the details, concept art and the decisions
still open. (Merged into `main` in October 2026.)

## The roadmap in three phases (27 November 2026)

1. **Collection** (built): the map, planets, achievements, easter eggs, predictions, mysteries, the wardrobe and
   spacecraft. Plans 1 to 11 below.
2. **Platform** (now): versioned saves, the Explorer Archive, Captain's Log, the prediction dashboard, the explorer
   profile with status in the header, the landing page, the Explorer Registry and cloud sync, security.
   [EXPLORER_JOURNEY.md](EXPLORER_JOURNEY.md) (13), [PLATFORM_HARDENING.md](PLATFORM_HARDENING.md) (14),
   [ACCOUNTS_AND_ACCESS.md](ACCOUNTS_AND_ACCESS.md) (12); overnight: the Platform queue in
   [LOOP_BACKLOG.md](LOOP_BACKLOG.md).
3. **Knowledge** (next): knowledge freshness with an evidence hierarchy, the Researcher's Journal, Star Gazer and
   Colossus as the observatory's researchers, the debates, Universe Enrichment.
   [KNOWLEDGE_AND_RESEARCHERS.md](KNOWLEDGE_AND_RESEARCHERS.md) (15).

The three layers they build: **the universe** (stars, planets, discoveries), **the explorer** (their journey) and
**the researchers** (Star Gazer, Colossus, later the Archivist).

## All plans

| # | Plan | Status | Next step |
|---|---|---|---|
| - | [BACKGROUND.md](BACKGROUND.md): pixel night-sky page background | **done** (October 2026, `web/src/55-backdrop.js`) | - |
| 1 | [WORLDS_MOONS_AND_SCREENS.md](WORLDS_MOONS_AND_SCREENS.md): hidden spacecraft until named, "lost in orbit" empty screen, a loading screen (a rock with moons), dwarf planets + their moons, exomoon candidates, water worlds from published studies | **half built** (spacecraft as lights, LOST IN ORBIT, loading rocket, dwarf planets); decisions answered (18 Oct) | build exomoons and water worlds |
| 2 | [HIGHLIGHTS.md](HIGHLIGHTS.md): accurate, explained highlights (Kopparapu habitable zone, facts vs predictions, radius errors), 9 new filters, combined filters with a results list | planned, numbers measured; **decisions answered** (18 Oct) | confirm predictions default; data first, then an independent data audit |
| 3 | [ACHIEVEMENTS_V2.md](ACHIEVEMENTS_V2.md): 13 chapters as real constellations, 35 new achievements, planets up close, Project Hail Mary (Tau Ceti, secret Erid), "What the alien doing", comets/asteroids/UFO sky events, rewards and titles | planned, concept art done; **decisions answered** (18 Oct) | build in its 5 steps |
| 4 | [CONSTELLATIONS.md](CONSTELLATIONS.md): the constellation data (d3-celestial, BSD) and how figures draw | data checked; pairing superseded by #2 | built as part of #2 |
| 5 | [TROPHIES_AND_DATA.md](TROPHIES_AND_DATA.md): **version updates** (semantic versions, changelog, GitHub Releases, "what's new in vX"), Gaia-based planet sizes, star types and life stages, brown dwarfs, the trophy ladder (new **nebula** tier, the **universe cup** for secrets), unique trophies, levelled achievements (DWARF KING, DWARF STAR) | planned, references fetched; **decisions answered** (18 Oct) | **version updates built: v1.0.0** (18 Oct; CHANGELOG.md, the antenna announces releases) | the nebula tier and universe cup |
| 6 | [UNIVERSE_SECTORS.md](UNIVERSE_SECTORS.md): the observable universe in sectors, ◀ ▶ / ↑ ↓ to move: a zoom-out ladder (Kepler's field → neighbourhood → Milky Way → Local Group → Laniakea → the observable universe), then the whole sky in 12 sectors with every known exoplanet | **ladder built** (October 2026, `56-universe.js`) | the whole sky in 12 sectors |
| 7 | [FLEET_CLOSEUPS.md](FLEET_CLOSEUPS.md): spacecraft hidden as flashing lights until named, animated close-ups (probes in space, robots on Mars, the Moon, Venus, Titan, a comet, an asteroid; active or mission ended), new robot easter eggs, special trophies (STILL ROLLING, HONOUR ROLL, FIRST FLIGHT, WORLDS TOUCHED) | flashing lights **built**; NASA's five Mars rovers **built** (v1.4 to v1.9); rover roster added (18 Oct, 17 rovers); Zhurong **built** (v1.9.8); Lunokhod 1 and Yutu-2 **built** (v1.9.9) with LUNAR DRIVERS and ROVER ROSTER | the other Moon rovers, then the small bodies |
| 8 | [STAR_GAZER_V4.md](STAR_GAZER_V4.md): **Colossus**, a giant-planet specialist beside V3 (which keeps the small planets); fixes giants and deep transits (stellar density check, transit shape, Gaia RUWE, difference images), explicit missing values, calibrated "not sure" band, optional TESS (V4.1); pre-registered, with a prospective test on NASA's future rulings | **Colossus failed; Colossus 2 (18 Oct): more giants found but miscalibrated, not adopted** (`docs/star-gazer/V4B_RESULTS.md`) | **V3.1 tested 18 Oct: failed** (both primary endpoints; `docs/star-gazer/V3_1_RESULTS.md`). V3 stays. Colossus 2 shown on the map as EXPERIMENTAL (v1.9.9.1) | **next: [COLOSSUS_3.md](COLOSSUS_3.md)** (plan, 21 Oct): fix its calibration first, then new evidence; registration before training |
| 9 | [SKY_EVENTS_DRAFTS.md](SKY_EVENTS_DRAFTS.md): the UFO crossing space (a rare version with a passing asteroid, WHAT WAS THAT?), asteroids, comets and meteors drawn after real photos | **comets, asteroids and the UFO built** (v1.1.0, 18 Oct); **meteors built both ways** (v1.9.9: catchable from the ISS, the page background) | done |
| 10 | [COMMIT_IDENTITY.md](COMMIT_IDENTITY.md): only the med27-coder account can change the project (signed commits, rulesets, push protection) | research notes | later, when the user is ready |
| 11 | [LOOP_BACKLOG.md](LOOP_BACKLOG.md): the unattended loop's work list | in progress | top item first |
| 12 | [ACCOUNTS_AND_ACCESS.md](ACCOUNTS_AND_ACCESS.md): accounts and access (IAM): log in with a proxy account and your progress loads in any browser; roles (visitor, player, tester, owner); a landing page with sign up; Supabase chosen | decisions taken (17 Nov: the suggested answers); **step 1 built, local only**: the database (Supabase) with 52 tests, run in CI; the catalog of achievement and easter-egg ids; pilots renamed explorers (28 Nov); the owner's script (tester accounts, backup, restore); the threat model and go-online checklist ([THREAT_MODEL.md](../star-map/THREAT_MODEL.md)) | sign up / sign in / sync in the page: **needs a choice** (the page's security policy must allow the Supabase address) |
| 13 | [EXPLORER_JOURNEY.md](EXPLORER_JOURNEY.md): the explorer's journey (from the user's roadmap notes): keep the game as it is; add versioned saves, a Captain's Log and a prediction dashboard (no account needed), an explorer profile and card, the Explorer Registry (the accounts), Star Gazer's contextual notes, long-term achievement families | **partly built** (27-28 Nov): versioned saves, the Explorer Archive, the prediction dashboard (live); Captain's Log (preview, `?log`); structured transmissions | the explorer profile with status in the header (D2), star card 2: next cycle |
| 14 | [PLATFORM_HARDENING.md](PLATFORM_HARDENING.md): the platform (from the user's overnight note): landing page second version, Explorer Registry UX, the security checklist against what exists, email vs the no-email decision, architecture, a safe overnight queue (LOOP_BACKLOG.md) | **overnight queue done** (27-28 Nov): landing v2 (preview, `?landing`), the database tests in CI, the threat model | going online: the checklist in THREAT_MODEL.md, when the user decides |
| 15 | [KNOWLEDGE_AND_RESEARCHERS.md](KNOWLEDGE_AND_RESEARCHERS.md): knowledge freshness with an evidence hierarchy (NASA changes data, papers need review, forums only suggest), a review queue in the repository, a knowledge report in the monthly refresh; Star Gazer and Colossus as the observatory's researchers, speaking only from real data; ASK STAR GAZER as a menu, then guarded conversations; the debates; the Researcher's Journal; Universe Enrichment | frameworks built (28 Nov): `knowledge/` with `scripts/knowledge/enrich.py`, and the knowledge report in the monthly refresh; decision 4 taken (menu first) | **decisions 1, 2, 3, 5** open; then the first reviewed worlds |
| - | [BADGES_AND_ICONS.md](BADGES_AND_ICONS.md) | done (October 2026) | - |
| - | [TATOOINE_AND_PROPHET.md](TATOOINE_AND_PROPHET.md) | done (October 2026) | - |

Concept art: `pixel-art/concepts/` (`scripts/starmap/draft_concepts.py`), references in `pixel-art/references/`.

## Tools and housekeeping

| Item | Status | Next step |
|---|---|---|
| **Pixel reader keeps translucency** (the `read_pixel_art` mod, kept outside this repo): today a cell under 50% opacity becomes fully transparent and one above becomes solid, so glows, glass and smoke are lost. Planned: keep each cell's real opacity in `native.png` and the preview, colours with opacity in the palette and `grid.txt` legend (8-digit hex, e.g. `#5f6fbf66`), near-equal opacities merged like near-equal colours, and a known half-transparent sprite added to its accuracy bench. Translucency already blended into a flat image (JPEG, screenshot) can't be separated from its background; it reads as the blended colour. | planned (2 Nov), about an hour | build when the user says go |
| **Private workshop repo** for plans while they're decided, egg spoilers, the cheat sheet and unready drafts; this repo stays public (free GitHub Pages needs it). Kept as a sibling folder, not a submodule. Never in either repo: keys, account passwords, the user's inspiration images, other local-only work. | suggested (2 Nov) | the user decides; also whether `plan/1.9.9.2` moves there |
| Running V3 without retraining: the model is only in the repo encrypted; publish it openly or host the demo on a Hugging Face Space | open question (2 Nov) | the user decides |

Still open (user): back up `.secrets/star_gazer.key`; GitHub Dependabot security updates and 2FA; finish the history purge (the "Protect main" rule must be paused for one push).
