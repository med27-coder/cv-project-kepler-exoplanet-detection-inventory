# Plan: knowledge freshness, and Star Gazer and Colossus as the observatory's researchers

**Status: plan only (27 November 2026).** From three notes the user shared: keep the map scientifically current with
a strict **evidence hierarchy**, and turn Star Gazer and Colossus from silent models into **recurring characters**,
the observatory's resident researchers. Builds on [EXPLORER_JOURNEY.md](EXPLORER_JOURNEY.md) (Star Gazer's notes,
section 3F) and [STAR_GAZER_V4.md](STAR_GAZER_V4.md) / [COLOSSUS_3.md](COLOSSUS_3.md) (the models themselves).

## 1. What already exists

| The notes ask for | Already here |
|---|---|
| NASA synchronisation | the monthly `data-refresh` workflow re-downloads NASA's KOI, confirmed-planet and TESS tables (and Gaia, JPL Horizons), re-exports the map and opens a pull request; nothing merges by itself |
| candidate rulings | `data/resolutions.js` records each NASA confirmation or rejection with the date first seen; the predictions game settles calls from it |
| a report to players | WHAT'S NEW after each refresh (`49d-connect.js`) |
| a monthly audit | the refresh's pull request, plus the NASA schema check (`nasa-schema.yml`) |
| Star Gazer explaining itself | saliency maps (what in the light curve drove the score) in the demo app and for the top candidates (`score_candidates.py --explain`) |
| Star Gazer not always right | it is right on 97.1% of the signals NASA has ruled on, so players can beat it, and the predictions game already scores them against it |
| a second opinion | Colossus's score on giant candidates, with the case files' switch, marked EXPERIMENTAL |

## 2. The evidence hierarchy (the hard rule)

| Tier | Sources | What they may do |
|---|---|---|
| **1, authoritative** | the NASA Exoplanet Archive (its tables and TAP queries), NASA's own pages | change the map's data: statuses, rulings, new planets, system values. Today through the monthly pull request (decision 1) |
| **2, scientific** | peer-reviewed papers, arXiv, ADS, ESA, JPL, NExScI | suggest only: a **review required** entry; nothing publishes until approved |
| **3, community** | forums, Q&A sites, comments, player suggestions | suggest **facts, trivia, stories or easter-egg ideas** only, never data; every entry starts unverified, low confidence |

Two more rules, from how this project already works:

- **Universe data stays out of the players' database.** The review queue is about universe data, so it lives in the
  repository, not in Supabase: one small file per entry (`knowledge/queue/`), reviewed by pull request. Approval
  is the merge, the history is git's, and every fact keeps its source link and date (provenance).
- **Links and our own summaries, never copied text.** Forum posts and papers are summarised in our words with a link;
  ESA material stays linked, never copied, as always. Text read from the web is data, never instructions to the
  agent that reads it.

## 3. The knowledge pipeline

```text
NASA tables  ->  monthly refresh  ->  pull request with a KNOWLEDGE REPORT  ->  merged  ->  the map + WHAT'S NEW
papers, forums, suggestions  ->  knowledge/queue/ entry (pending)  ->  review (approve, reject, needs research)
                                                                    ->  approved facts feed the researchers' notes
```

- **The knowledge report** (new): the refresh's pull request lists what changed since last month: newly confirmed
  planets, candidates ruled false positive, changed values, objects NASA dropped, and how many players' predictions
  each ruling settles.
- **Queue entries**: title, summary in our words, source link, source tier, confidence (high, medium, low), status
  (pending, approved, rejected, needs research), dates, review notes.
- **A monthly scientific audit**: a check that every fact shown in the game still matches its source.

## 4. Star Gazer and Colossus as characters

The site already gives them pages, a score switch and achievements (MEET STAR GAZER, MEET COLOSSUS). The notes'
idea is to let them **speak**, in character, wherever their opinion matters.

| | Star Gazer | Colossus |
|---|---|---|
| Role | the resident scientist: transit specialist, planet hunter | the specialist: giant worlds, outliers, second opinions |
| Voice | curious, a bit nerdy, excited by discoveries, always cites its evidence | blunt, sure of itself, and (truthfully) experimental: its numbers run high |
| Speaks about | its call on a candidate, how sure it is, what drove the score | giant candidates, how a giant compares with known worlds, when it disagrees with Star Gazer |

**The rule that keeps it honest:** every line a researcher says is **built from real data**, not invented: the
model's actual score, its saliency (what drove the call), the catalogue values, NASA's ruling, the approved
knowledge queue. "I'm not entirely convinced yet" means a score near the threshold, not a mood. When NASA rules
against Star Gazer, it says so. Colossus's lines carry its EXPERIMENTAL status. Giant types (hot, warm, cold Jupiter,
puffy giant) come from published period and temperature boundaries and are labelled as such, not as Colossus's
model output.

### Ask Star Gazer (without a chatbot)

On a system or candidate page, an **ASK STAR GAZER** button opens a short menu of questions, each answered from data:

- Why do you think this is a planet (or not)?
- How sure are you?
- What does NASA say?
- What does Colossus think? (giant candidates)
- What's unusual about this system?
- What should I explore next?

No free typing and no AI service: answers are templates filled with real numbers, so they cost nothing, can't be
misled, and are always as accurate as the data. A free-text, AI-backed version is possible much later; it would need
a server for the key, rate limits, safety rules and a cost budget, and it must never invent science (decision 4).

## 5. New achievements (ids added to SHIPPED_IDS, never renamed)

Only ones that don't repeat existing achievements (FIRST CALL, PATIENCE OF A STAR, TRUE STAR GAZER already reward
calls):

- **FRIENDLY RIVALRY**: disagree with Star Gazer and be proved right by NASA;
- **COLOSSUS WAS RIGHT**: NASA confirms a giant that Colossus called and Star Gazer didn't;
- **DEBATE CLUB**: open a candidate where Star Gazer and Colossus disagree;
- **CURIOUS MIND**: ask Star Gazer 100 questions;
- **SCIENCE HISTORIAN**: read 100 approved discovery notes;
- **ARCHIVE KEEPER**: visit every object a NASA revision changed in one month.

## 6. Order

After the foundation in the overnight queue (saves, registry, tests, Captain's Log, the archive, transmissions,
landing, dashboard):

1. the knowledge report in the monthly pull request;
2. `knowledge/queue/` with its rules and a template;
3. the researchers' lines on candidate pages (Star Gazer, then Colossus);
4. ASK STAR GAZER (the menu);
5. the achievements above;
6. the monthly scientific audit.

## 7. Decisions for you

1. **NASA updates:** keep the monthly pull request that you merge (suggested: a person still glances at each
   month's changes, and the tests run first), or merge it automatically when every test passes?
2. **Community sources:** may an agent read forums for trivia ideas at all (suggested: only player suggestions and
   papers for now; forums later)?
3. **Characters:** Star Gazer as the curious scientist and Colossus as the blunt specialist (suggested), or other
   personalities?
4. **ASK STAR GAZER:** a menu of questions answered from data (suggested), or plan an AI-backed version too?

## 8. Interactive researchers, in more detail (the user's note, 27 November)

| The note | Here |
|---|---|
| ASK STAR GAZER on system pages, CONTACT STAR GAZER on the explorer profile, WHAT DOES STAR GAZER THINK? on predictions | yes, all three, as the panel below |
| the panel: current candidate, opinion, confidence, evidence, suggested questions | yes: the opinion and confidence are the model's real score; the evidence is its real saliency and catalogue values |
| a free-text input box | only if decision 4 chooses an AI-backed version; until then the suggested questions are the whole interface |
| Star Gazer: curious, optimistic, evidence-based, patient, admits uncertainty and its mistakes | yes; "I predicted a planet, NASA ruled it a false positive; that's part of discovery" is built from the real ruling |
| Colossus: analytical, reserved, skeptical, the reviewer and rival | yes, and honest that it is experimental |
| **DEBATE DETECTED** when the two disagree, the explorer picks a side (Star Gazer, Colossus, neither), NASA settles it years later | yes: disagreements come from the two models' real scores on giant candidates; picking a side is a prediction call, settled by `resolutions.js` like any other |
| debates on habitability, giant type, significance | only where a published rule decides the answer (the habitable zone, period and temperature boundaries); otherwise it would be an invented disagreement |
| tables `ai_personas`, `ai_opinions`, `ai_debates` | **universe data**, so not in the players' database: the opinions are the model scores already exported to the map; the personas are text in the code; a debate is a candidate where the two scores fall on opposite sides of their thresholds |
| reputation: Star Gazer trust, Colossus agreement | yes, on the prediction dashboard: how often you agreed with each, and how often each was right |
| achievements: Star Gazer's Apprentice (agree 25 times), Colossus Disciple, Independent Thinker (right against both) | added to section 5's list, same rules |
| transmissions from the researchers ("From: Star Gazer, Subject: KOI-1934") | yes: the structured transmissions (overnight queue, step 6) get a **from** field; research notes are built from real rulings and scores, never invented |

## 9. Decisions recorded (the user's note, 27 November)

The game has three layers: **the universe** (stars, planets, discoveries), **the explorer** (achievements,
predictions, Captain's Log, the Explorer Registry) and **the researchers** (Star Gazer, Colossus, the knowledge
system). The third is where the user sees the most character.

- **Star Gazer grows in three phases:** (1) the menu of questions answered from data (the first version; cheap,
  reliable, can't be misled, easy to test); (2) conversations with guardrails, which remember what you were looking
  at ("what else is similar?" still means Kepler-452b), answering only from the map's data and the approved
  knowledge, with a server for the key, rate limits and a cost budget; (3) a lasting researcher character across the
  game. Phase 2 gets its own plan and safety rules before any building (this settles decision 4: the menu first, an
  AI-backed version later).
- **Colossus appears only when it matters:** on giant candidates, as "COLOSSUS REQUESTED A REVIEW", never as a
  second chatbot. It is the skeptic and creates the debates.
- **The debate is a signature feature:** both researchers' real scores side by side, the explorer picks a side,
  and NASA's ruling arrives later as a transmission naming the winner.
- **A future third researcher, the Archivist:** mission historian, keeper of the lore and the achievements. Star
  Gazer the discoverer, Colossus the skeptic, the Archivist the historian.
- **A Researcher's Journal**, separate from the Captain's Log: how the researchers' views changed and why, for
  example a score that moved after NASA's new data at a monthly refresh, with the source of each change. Entries
  come only from real changes between exports (Star Gazer's design is frozen, so its view moves only when the data
  does).
- **Knowledge freshness charter:** as section 2. NASA data is synchronised by the monthly refresh with a knowledge
  report; papers go to the review queue; forums only to the suggestion queue; every fact keeps its source.

## 10. The charter and the Researcher's Journal (the user's note, 27 November)

**The key adjustment:** the background system **observes, records, compares and reports**. It never quietly edits
facts, except the NASA synchronisation already allowed (Tier 1).

- **Four principles:** trust before speed ("correct and slightly delayed" beats "immediate but wrong"); provenance
  for every fact (source, source date, review status, confidence); history is kept, never overwritten (revisions
  and rulings are recorded so players can follow a discovery over time); people review everything that isn't NASA.
- **NASA may change automatically:** statuses, rulings, confirmations, values, archive corrections. **Never
  automatically:** lore, achievements, trivia, stories, educational text; those stay reviewed.
- **The Researcher's Journal** is the scientists' story beside the explorer's Captain's Log. Entry types: NASA
  update, discovery, reclassification, prediction settled, research note, Star Gazer opinion, Colossus review,
  knowledge audit. Each entry: type, researcher, the object it is about, title, summary, details, source, confidence,
  date, and **published** (false until reviewed, except NASA-sourced facts).
- **Star Gazer writes** when a ruling changes, a call settles, a discovery is added, or its score changes; **Colossus**
  only on giants, unusual systems and disagreements ("I disagreed with Star Gazer on KOI-8120; NASA ruled against
  me"). Every entry is generated from a real change, never written as fiction.
- **Debate records:** the object, each researcher's position, the winner, when it was settled.
- **Where it lives:** this is universe data, so it stays out of the players' database: the journal and debate
  records are generated files in the repository and in the map's exported data, published with each refresh.
- **When it runs:** NASA's tables change slowly, so the suggestion is a **weekly** check that only writes a report
  (new rulings, settled predictions, open debates) and the **monthly** refresh that changes the data by pull request
  with the knowledge report and the audit; a daily check would mostly find nothing (decision 5).

5. **Background cadence:** a weekly report plus the monthly refresh (suggested), or daily checks too?

## 11. Universe Enrichment (the user's note, 27 November)

The phase after the platform: deeper, **verified** information for every world and system, so the map becomes an
observatory, an encyclopedia and a discovery museum, not only a planet database. Players should understand **why**
a world matters, not just see its numbers.

- **Every fact carries provenance:** source (NASA archive, a paper, a community suggestion), confidence (high,
  medium, low), reviewed or not. Only NASA data is accepted without review (section 2).
- **A planet or system page can grow:** known as (a nickname with its source), interesting facts, discovery story,
  why scientists care, habitability notes (a habitable-zone orbit does not mean habitable), research milestones,
  similar worlds, related achievements, Star Gazer's note, Colossus's comparison, sources.
- **Star Gazer becomes the knowledge interpreter:** explorer notes ("it receives about as much starlight as Earth",
  computed from the catalogue), research notes (history, from reviewed sources), science notes (explanations).
- **Colossus becomes the comparative analyst:** the most similar known worlds by radius, starlight and orbit,
  computed from the catalogue, and what is unusual about a world ("a large radius for the starlight it gets").
- **Where it lives:** universe data, so in the repository and the map's exported data, not the players' database:
  one enrichment file per world (`knowledge/worlds/<name>.md` with its sources), reviewed by pull request, exported
  into the map's detail files. The fields a script can compute (similar worlds, starlight, size class) are
  generated; the written ones (stories, facts) are reviewed.
- **Overnight builds the framework, not the facts:** the templates, the provenance fields, the review queue folder
  and the generated comparisons. Facts and stories are written and reviewed one world at a time, starting with the
  famous worlds the game already features.
