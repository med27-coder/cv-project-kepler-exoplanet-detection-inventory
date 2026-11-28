# Knowledge: what the map says about each world, and where it comes from

The framework for **Universe Enrichment** (`docs/plans/KNOWLEDGE_AND_RESEARCHERS.md`, sections 2 and 11): deeper,
verified information for the worlds on the map, so a player learns why a world matters, not only its numbers.
This folder is universe data. It never goes in the players' database.

## The rule: every fact has a source

| Tier | Source | What it may do | Review |
|---|---|---|---|
| 1 | the NASA Exoplanet Archive, NASA's own pages | the numbers (radius, orbit, starlight, status, discovery year) | none: the monthly data refresh brings them, by pull request |
| 2 | peer-reviewed papers, mission pages (ESA, JPL) | stories, history, why scientists care | a person reads the source before merging |
| 3 | player suggestions, forums, trivia sites | ideas only: a suggestion for a person to check against tier 1 or 2 | never merged as a fact on its own |

Each written fact carries its **provenance**: the source (a link or a paper's reference), the source's date, a
confidence (high, medium or low) and whether it has been reviewed. A world's file without sources is not merged.

## The folders

- `worlds/`: one file per world, named after it (`kepler-22-b.md`). Start one with
  `scripts/knowledge/enrich.py "<world>" --write`, which copies [worlds/TEMPLATE.md](worlds/TEMPLATE.md) and fills
  its **generated block**: what a script can compute from NASA's values (size class, starlight, temperature, year,
  the habitable zone, the discovery year, the most similar worlds, how unusual its size is). Running it again
  refreshes only that block. Everything outside the block is written by a person and reviewed.
- `queue/`: suggestions waiting for a person ([queue/README.md](queue/README.md)). A suggestion becomes a fact only
  by moving into a world's file, with its source, in a reviewed pull request.

## How a world's page grows

1. Generate the file (the numbers, all tier 1).
2. Write the sections one at a time, each fact in the sources table: the summary, the discovery story, why
   scientists care, interesting facts, research milestones (the Archivist's notes), Star Gazer's note.
3. A pull request; a person checks every new fact against its source; merge.
4. Later (not built yet), the map's export reads `worlds/` and shows the reviewed sections on the world's card.

Star Gazer's and Colossus's notes speak only from real data: their scores, NASA's rulings, these computed
fields. Nothing in this folder is invented, and no fact is written by an unattended run.
