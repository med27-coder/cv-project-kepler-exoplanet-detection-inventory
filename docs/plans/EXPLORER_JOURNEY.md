# Plan: the explorer's journey (persistence, identity, a log of discoveries)

**Status: partly built (28 November 2026):** A versioned saves, A2 the Explorer Archive, B the Captain's Log (preview, `?log`), C the prediction dashboard, E's rename to explorer and its screens (preview, `?landing`). Planned on 27 November 2026. Built from three roadmap notes the user shared ("take this all into
consideration"). Their main point, which this plan keeps: **do not redesign the game.** The achievements,
easter eggs, mysteries, wardrobe, spacecraft, daily mystery and the prediction game are the strongest part of the
project. What is missing is a lasting **explorer journey**: an identity, a history of what you found, and progress
that survives a new browser.

Builds on [ACCOUNTS_AND_ACCESS.md](ACCOUNTS_AND_ACCESS.md) (accounts, the landing page, the database) and changes
none of its decisions unless one below says so.

## 1. What already exists (more than the notes assumed)

| The notes suggest | Already in the game | Gap |
|---|---|---|
| export and import progress | the backup file in Settings (`48-gallery.js`), merged safely by `mergeProgress` | the saved data has no version number of its own (only the storage key ends in `.v1`) |
| dates on everything | every achievement, egg and planet-or-not call keeps the day it happened | nothing shows them together |
| prediction settlement | `data/resolutions.js` records each NASA ruling with its date; `checkPredictions` pops up a result and awards FIRST CALL, PATIENCE OF A STAR, TRUE STAR GAZER | no running record (made, correct, wrong, waiting, average wait) |
| star cards | DOWNLOAD MY STAR CARD (`49d-connect.js`): emblem, badges and stats as a 240 x 135 pixel picture | no favourite world, prediction record or join date on it |
| incoming transmissions | the antenna (`49e-thanks.js`): a thank-you note and every version's notes from `HISTORY` | written in code, so a message needs a release |
| a guide, not a chatbot | the landing preview's Star Gazer line; every egg has fun facts (`48c-egg-facts.js`) | no notes while you explore |
| cartographer, census, streaks | CARTOGRAPHER, GALACTIC CENSUS (levelled), WEEK OF WONDERS, MYSTERY SOLVED | long-term families (months active, prediction counts, reading everything) |
| universe data apart from explorer data | universe data is generated static files (`web/data/`); explorer data lives in the browser and, soon, the database | already separate: keep it that way |
| one account record that matches the export file | `load_progress` returns the same shape as the backup file | none |

## 2. What changes from the notes, and why

| The notes say | Here | Why |
|---|---|---|
| "Kepler v2.0", save format `"version": "2.0"`, Versions 1 to 7 | releases keep counting 1.9.9.2, 1.9.9.3...; the saved data gets its own **format number** (`saveFormat: 2`) | the project's rule: versions never jump to 2.0, so players read them in order. A schema number is internal and separate |
| OAuth (Google, Microsoft, GitHub) and email | pilot names and passwords only | decided 17 November: proxy accounts, no real identities. Can be revisited if real accounts are ever wanted |
| analytics in the platform services | none | the landing page promises "no analytics or tracking" |
| containers: web, api, worker, ai-guide, postgres, redis | web (the static site; nginx in the `docker-setup` branch), Supabase (sign-in, API and Postgres in its own containers), GitHub Actions as the worker | Supabase's API is our API; the monthly data workflow already fetches NASA updates and records rulings; Redis has nothing to cache at this size |
| an AI guide service | scripted, contextual lines in the page, no AI calls | the notes themselves say "not a chatbot"; no server, no cost, no abuse to rate-limit. A real AI service would need its own plan (cost, limits, safety) |
| transmissions stored in a database, posted by an admin | they stay in `HISTORY` for now | they belong to releases; a database copy adds a write path and a fetch on every visit. Revisit once accounts are online |
| public explorer pages, following, shared finds | not now | progress is checked for shape but written by the player's own browser, so public numbers could be faked; public names would need checking; nothing is shared today, which keeps the privacy promise simple |
| a server-side achievements catalogue | yes, but generated | a `catalog` table of every shipped achievement and egg id, filled from `SHIPPED_IDS`, lets the database refuse made-up ids (the security review suggested this) |
| storage: local, cloud or hybrid | **local** (as today) or **local + cloud** | a cloud-only mode would lose progress offline and adds a third path to test |

## 3. The pieces, in the order that pays off first

The first three need **no accounts and no server**: they work for every player, guests included.

### A. Versioned saves (foundation)

- `saveFormat: 2` in the saved data, and a list of small upgrade steps (`1 -> 2`, later `2 -> 3`), run when progress
  loads from the browser, a backup file or the account. `mergeProgress` stays the tolerant reader.
- The backup file carries the schema number; old files keep loading.
- The database's `progress` record already has a `schema` column.

### A2. The Explorer Archive

The backup file grows into the **Explorer Archive**: one format for the local backup, the cloud copy and any future
move, holding achievements, easter eggs, predictions, mysteries, settings, favourites, discovery history and the
Captain's Log, with `saveFormat`, `gameVersion` and `exportedAt`. Old backup files keep loading.

**Built 27 November** (`explorerArchive()` in `48-gallery.js`): DOWNLOAD MY EXPLORER ARCHIVE writes
`kepler-explorer-archive-<date>.json` with `kind: "explorer-archive"`, the format fields, a `summary` (counts for
people reading the file), the whole saved progress and the Captain's Log as `[date, kind, title]` rows. Loading
reads only the progress; the summary and the log are rebuilt from it, so a hand-edited log changes nothing.

### B. Captain's Log

A journal built from dates the game already keeps, newest first, in the Galleria:

| Entry | From |
|---|---|
| achievement earned | `progress.ach` dates |
| easter egg found | `progress.eggs` dates |
| a call made: planet or not, and Star Gazer's call | `progress.calls` |
| a call settled by NASA: right or wrong, and how long it waited | `resolutions.js` dates |
| daily mystery solved, streaks | `progress.daily` |

Each entry gets a line of context from the facts already written (`48c-egg-facts.js`, the achievement text), never a
spoiler for an egg not yet found. A **discovery timeline** is a view of the same log: firsts only (first planet,
first habitable world, first correct call, 1,000 stars seen).

### C. Prediction dashboard

In the predictions tab: calls made, correct, wrong, waiting, the average wait for a ruling, and how often you agreed
with Star Gazer, and on giants how often you agreed with Colossus. All from data the page already has.
The user rates this a **signature feature**: the predictions game is more unusual than the achievements.

### D. Explorer profile and card

- A profile panel: your name (decision 1), rank, achievements, systems visited, stars seen, the prediction record,
  a favourite world (one of your saved systems) and the date you started (the earliest date in your progress).
- The star card gains the prediction record, favourite world and start date. PNG as today; a PDF or a public link
  only with the community layer (section 2).

### D2. Status in the header, the collection in the museum (the user's note, 27 November)

Today the header shows the rank (emblem, name, bar, count), the badges and up to three showcase trophies as small
icons. A new player can't tell what the icons mean, which achievements are close, which categories are complete,
what is rare or what to chase next. The fix, as in Steam, PlayStation and Xbox: **progress first, icons second.**

- **The header answers "who am I, how far along am I":** the rank emblem, PULSAR, 64 / 81 and the percentage. The
  badge and trophy icons move out of the header to the explorer profile.
- **The rank opens the explorer profile**, starting with a status panel: the bar and percentage; NEWEST (the last
  achievement earned); RAREST (by the game's own rarity tiers, `TIER_OF`, since there are no player statistics:
  no analytics); SUGGESTED NEXT (the closest unearned achievement that isn't secret, so no spoilers); the
  collection focus (the category you have earned most in lately).
- **Categories with bars:** exploration, science, predictions, mysteries, spacecraft, easter eggs (from the
  achievements' existing groups, checked one by one), e.g. PREDICTIONS 5 / 10, so "17 missing" becomes "3 science
  left". Secret achievements count as "?" until found.
- **The achievement museum** (VIEW COLLECTION): the full collection, as the achievements tab is today.
- **The showcase** you choose (`progress.showcase`) stays, shown on the profile and the star card instead of the
  header.
- **Later, the profile gathers everything:** the explorer card, Captain's Log, the museum, the prediction dashboard
  and the Explorer Registry in one place.

### E. The Explorer Registry (accounts)

The accounts plan, presented as joining the **Explorer Registry**: "Save your journey forever", always optional,
with PLAY NOW as a guest. Settings shows **Progress kept: this browser** or **this browser + your account**. The
database work is done (`supabase/`); next is sign up, sign in and sync in the page.

### F. Star Gazer's notes (the guide)

Short, scripted notes at the right moment, with a setting to turn them off:

- opening a famous system: an **Explorer note** ("Kepler-452b is often called Earth's cousin");
- earning an achievement: a **Did you know?** line from its facts;
- viewing a candidate: a **Prediction note** ("NASA has not ruled on this one yet"; "Star Gazer disagrees with you").

### G. New long-term achievement families

Ids added to `SHIPPED_IDS` and never renamed, as always; none may repeat an existing one (CARTOGRAPHER and GALACTIC
CENSUS already reward stars seen; WEEK OF WONDERS rewards a streak):

- **Explorer legacy:** returning across 1 month, 6 months, a year (from the dates already kept);
- **Prediction scientist:** 10, 25, 100 calls made; 10 and 25 correct; 3 times right when Star Gazer was wrong;
- **Archivist:** every famous world's page, every mission, every dwarf planet read.

### H. Later, if ever

Database-backed transmissions; public explorer pages and community features; an AI-backed guide.

## 4. Releases

Each step is a normal release in the project's numbering, after the 1.9.9.2 easter eggs already planned:
A and B together, then C, then D, then E (when the accounts are ready to go online), then F and G.

## 5. Decisions (taken 27 November 2026)

1. **Name: explorer**, not pilot (Explorer Registry, Explorer Profile, Explorer Card, Captain's Log). Renamed in the
   accounts work while nothing is online (overnight queue, step 7).
2. **Order:** the no-account pieces first. Captain's Log moves up, before accounts go online.
3. **Transmissions:** a proper data model now, **in code** (version, category, title, body, date), shaped like a
   future `transmissions` table; a database table only when posting without a release is worth it.
4. **Community features:** not now.
5. **New achievement families:** later, after the foundation (none yet decided individually).
6. **Sign-in:** names and passwords only. Email stays out of accounts; an optional, off-by-default email list may
   come later (PLATFORM_HARDENING section 7).
