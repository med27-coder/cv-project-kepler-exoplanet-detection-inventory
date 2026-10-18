# Documentation

## The model: Star Gazer ([star-gazer/](star-gazer/))

| Document | Read it for |
|---|---|
| [AUDIT_V3.md](star-gazer/AUDIT_V3.md) | The independent check of the V3 results: leakage, test-set tuning, re-runs. Verdict: genuine |
| [DATA_ANALYSIS.md](star-gazer/DATA_ANALYSIS.md) | Where Star Gazer succeeds and fails: by planet size, signal strength, period, star; its biggest mistakes; the candidates |
| [EXPERIMENTS_V3.md](star-gazer/EXPERIMENTS_V3.md) | Follow-up experiments: the TESS transfer test and the feature ablations (Gaia, `koi_count`) |
| [V4_PREREGISTRATION.md](star-gazer/V4_PREREGISTRATION.md) | V4, Colossus (a giant-planet specialist): the design, data and decision rules, fixed before training |
| [V4_RESULTS.md](star-gazer/V4_RESULTS.md) | Colossus's result: the primary endpoint failed (72% vs V3's 81% giant recall), and what was learned |
| [V4B_PREREGISTRATION.md](star-gazer/V4B_PREREGISTRATION.md) | Colossus 2: V3's network reading the light curve, with physics features, fine-tuned on giants (registered; running) |

## The site: Kepler Star Map ([star-map/](star-map/))

| Document | Read it for |
|---|---|
| [DATA_DICTIONARY.md](star-map/DATA_DICTIONARY.md) | Every field in the star map's data files, with units and sources |
| [EASTER_EGGS.md](star-map/EASTER_EGGS.md) | Spoilers: every easter egg and achievement, and how to find them |
| [STAR_GAZER_MISSION.md](star-map/STAR_GAZER_MISSION.md) | The game's design: the final TRUE STAR GAZER mission, rank emblems from stardust to a black hole |
| [STARMAP_PLAN.md](star-map/STARMAP_PLAN.md) | The star map's roadmap, phase by phase |

## Planning and everything else

| Document | Read it for |
|---|---|
| [plans/](plans/) | Plans for upcoming features; [plans/README.md](plans/README.md) is the planner (what's next, what's done, open decisions) |
| [IMPROVEMENTS.md](IMPROVEMENTS.md) | Project-wide backlog: what's done, what's open, what isn't feasible |
| [media/](media/) | The README's banner, screenshots and link previews (made by `scripts/starmap/make_readme_media.py`) |
| [presentation/](presentation/) | The portfolio deck (`.pptx`) and the course PDF |

Also at the top level: [README.md](../README.md) (overview and results), [CONTRIBUTING.md](../CONTRIBUTING.md)
(architecture, setup, checks), [SECURITY.md](../SECURITY.md), [TERMS_OF_USE.md](../TERMS_OF_USE.md),
[LICENSE](../LICENSE) and [NOTICE.md](../NOTICE.md) (third-party material).
