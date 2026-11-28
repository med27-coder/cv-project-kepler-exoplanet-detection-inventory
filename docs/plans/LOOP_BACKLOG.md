# Loop backlog: work the unattended loop can pick up

Set up 18 October 2026, while the user is away ("fix bugs, update the code with cleaner ways to run it, set up new
drafts and ideas"). One item per loop turn; mark it done here with the version or commit. Rules:

- Ship only what is tested: the full suite, ruff, the web build check and `node --check` must pass, then CI.
- Each player-facing change is a release via `/release` (1.9.2, 1.9.3...; never 2.0), with "New:"/"Fixed:" notes.
- Anything needing the user's choice (a new egg's look, rarities, which draft) becomes a **draft** in
  `pixel-art/concepts/` and a question in the hand-off notes, not a shipped feature.
- Never commit secrets, film stills or ESA images; never tune Star Gazer on the test split; replaced art goes to
  `pixel-art/archive/` first.

## Platform queue (27 November), top first

The user's order (27 November, refined in a second note after reviewing PLATFORM_HARDENING.md and EXPLORER_JOURNEY.md). Everything local;
nothing goes online; no email; no new sign-in providers; anything that needs a choice stops and goes in the hand-off
notes. Run `scripts/accounts/manage.py backup` before any `supabase db reset`. Read the specific official page a
step needs (Supabase Auth and row-level security, OWASP cheat sheets, PostgreSQL, Docker, GitHub Actions), not
documentation for its own sake.

**Tier 0, the foundation (finish first):**

1. **[done 27 Nov, see the commit "Versioned saves"]** **Versioned save format** (EXPLORER_JOURNEY A): saved progress and the backup file carry `saveFormat: 2` (a whole
   number; today's saves count as 1, so upgrade steps stay simple), `gameVersion` (the site's version) and
   `exportedAt`; upgrade steps run on load from the browser, a backup file or the account; `mergeProgress` stays the
   tolerant reader. Tests: old saves and old backup files still load; a file from a newer format is refused politely.
2. **[done 27 Nov, see the commit "Catalog"; one `public.catalog` table with a `kind` column instead of two, so `finds`
   has a real foreign key; an unknown id in a save is skipped, not the whole save]** **Achievement and easter-egg registry validation**: `achievement_catalog` and `easter_egg_catalog` in the
   database, **generated from the game's own lists** (the code stays the master copy, `SHIPPED_IDS`), so `finds`
   refuses ids that don't exist; a test that fails if the code and the tables ever differ.
3. **[done 27 Nov, see the commit "CI: the database"]** **Database migration tests on every push**: a CI job that starts Supabase and runs `supabase test db`
   (migrations, foreign keys, the catalogue, importing a save, the row rules); a browser test that NASA's rulings
   still settle predictions.

**Tier 1, the best overnight work:**

4. **[done 27 Nov, see the commit "Captain's Log"; `web/src/49g-log.js`, the LOG tab with `?log`]** **Captain's Log foundation** (EXPLORER_JOURNEY B): the journal from the dates already kept (achievements, eggs,
   calls, NASA's rulings, daily mysteries), newest first, no spoilers; a draft view behind a preview switch until
   it is released.
5. **[done 27 Nov, see the commit "Explorer Archive"; still `saveFormat` 2, since the archive only adds `kind`, `summary` and `log`, which loading ignores]** **Explorer Archive export format**: the backup file becomes the **Explorer Archive**, one format for a local
   backup, the cloud copy and any future move: achievements, easter eggs, predictions, mysteries, settings,
   favourites (saved systems), discovery history and the Captain's Log, with `saveFormat`, `gameVersion` and
   `exportedAt`. DOWNLOAD / LOAD keep working with old files.
6. **[done 27 Nov, see the commit "Transmissions"; `TRANSMISSIONS` in `00-version.js`, HISTORY unchanged so `/release` works as before]** **Incoming Transmission structured model**: `HISTORY` (`00-version.js`) gets the shape of a future
   `transmissions` table (version, category, title, body, date; categories: patch notes, developer logs, mission
   updates, announcements), still in code and still shipped with each release; the antenna reads the new shape.
7. **[done 27 Nov, see the commit "Landing page v2"; screenshots at desktop and phone width checked; cloud sync says COMING]** **Landing page, second version** (PLATFORM_HARDENING section 1), behind `?landing`: the journey in four steps
   (explore 3,600+ systems, predict planets before NASA confirms them, collect achievements and secrets, build your
   explorer journey), START EXPLORING beside JOIN THE EXPLORER REGISTRY, the visitor's own stats; screenshots at
   desktop and phone width.
8. **[done 27 Nov, see the commit "Prediction dashboard"; a call now also keeps Colossus's opinion on giants (the fifth item of a call), so agreement with Colossus counts from calls made from now on]** **Prediction dashboard foundation** (EXPLORER_JOURNEY C): calls made, correct, wrong, waiting, the average wait,
   agreement with Star Gazer and (on giants) with Colossus; built from data the page already has.
9. **Explorer Registry mockups**: "pilot" becomes **explorer** everywhere (the database column and messages, the
   sign-in address `<name>@explorers.invalid`, `manage.py`), a new migration, the tests updated; the sign-up and
   sign-in screens with CONTINUE AS GUEST beside JOIN, behind `?landing`, talking only to the local Supabase.
10. **Threat model and launch checklist** in `docs/`: who might attack what and what stops them; sequence diagrams
    (sign up, sign in, save, merge, delete); the go-online checklist (project, keys, security policy, Terms 1.2,
    backups, two-step sign-in for the owner), written, not done.

**Tier 2, if time is left (frameworks, no new facts):**

11. **Universe Enrichment framework** (KNOWLEDGE_AND_RESEARCHERS section 11): `knowledge/` with a README of the
    rules (evidence tiers, provenance, review by pull request), `knowledge/queue/` and `knowledge/worlds/` templates
    (summary, discovery story, interesting facts, why scientists care, Star Gazer's note, Colossus's comparison,
    related worlds, sources), and a script that **computes** the generated fields for a world from the catalogue
    (starlight relative to Earth, size class, the most similar known worlds), with tests. No facts or stories are
    written overnight.
12. **The knowledge report** in the monthly data refresh's pull request (new confirmations, rulings, changed
    values, dropped objects, predictions settled), built by a script with tests; the workflow itself only gains a
    step that adds the report to the pull request's text.

**Next cycle (not overnight):** cloud sync online and the Explorer Registry live, the explorer profile, star card 2,
Star Gazer's notes, then the knowledge and researchers plan ([KNOWLEDGE_AND_RESEARCHERS.md](KNOWLEDGE_AND_RESEARCHERS.md)).

## Queue (top first)

**Queue finished 18 October 2026.** The user then chose: meteors both ways and the Moon rovers (built in v1.9.9),
and Colossus shown as EXPERIMENTAL beside Star Gazer (in progress: candidate scores, then the switch). Also fixed in
v1.9.9 from a user report: Kepler-451 appeared under its 2MASS number with one planet of three.

0. **Hubble Space Telescope** (user report: searching "hubble space telescope" or "hubble telescope" finds nothing).
   Add it as an easter egg like the ISS (an Earth-orbit exception): a pixel Earth with Hubble on its orbit, its
   sprite, Galleria card with NASA's photo, fun facts, search words (hubble, hst, hubble telescope, hubble space
   telescope). New egg id `hubble` (add to SHIPPED_IDS).
0a. **Project Hail Mary at Tau Ceti** (user request, 18 Oct): Tau Ceti is outside Kepler's field, so searching it
   finds nothing today. Add "tau ceti" as a special system view: the real star (G8 V, 11.9 light-years, in Cetus) and
   its four planet candidates from Feng et al. 2017, clearly marked unconfirmed (g 20.0 d, h 49.4 d, e 162.9 d,
   f 636 d; a = 0.133, 0.243, 0.538, 1.334 AU; minimum masses 1.75, 1.83, 3.93, 3.93 Earths). Before it is found,
   the Hail Mary is a glowing, pulsing dot next to one planet (like the hidden spacecraft); "hail mary" /
   "project hail mary" / "astrophage" reveals the ship (egg `hailmary`, sprite, Galleria card, fun facts, why it's
   here). The story's planet Adrian is fictional: say so. The secret Erid egg stays a later item.
0b. **Haumea after NASA's Eyes on the Solar System** (user's screenshots, reference only, not committed): redraw
   Haumea's pixel globe as the stretched egg it is, grey-brown with the darker patch, and show its two moons on their
   tilted orbits (Hi'iaka, the larger and farther; Namaka, closer, on a strongly inclined orbit) in its close-up and
   Galleria card; check facts against NASA's Haumea page.
1. **Astronaut spin as one sprite rotating** (user idea, low priority): draw the astronaut once to a small offscreen
   canvas and rotate that image, instead of re-plotting pixels at each angle, so it spins smoothly and costs less.
   Draft both side by side first; ship if it looks better.
2. **Bug sweep:** look for other views that can be overwritten by a slow-loading star (the race fixed in
   `showUnknown` / `showHome`), and for listeners added more than once.
3. **Cleaner code:** share the duplicated Mars sky/ground helpers between `47d-martian.js` and `47e-rovers.js`;
   small, tested refactors only.
4. **Meteor drafts:** prepare the "both" option (v3a over Earth/ISS and the Solar System, v3b as the background's
   shooting star) as a draft for the user to approve.
5. **Zhurong** (China's Mars rover, 2021) as a draft scene, next on the rover roster (FLEET_CLOSEUPS.md 3A).
6. **Moon rover drafts:** Lunokhod 1 and Yutu-2 concept art.
7. **Performance check:** frame cost of the map with sky events and the backdrop on a phone-size viewport.

## Done

- 0. Hubble Space Telescope: v1.9.3.
- 0a. Project Hail Mary at Tau Ceti: v1.9.4 (plus the orbit-inside-the-star note, a user report).
- 0b. Haumea after NASA's Eyes: v1.9.5.
- 1. Astronaut spin from pre-turned frames: v1.9.6.
- 2. Bug sweep (slow-load races, duplicate listeners): v1.9.7, one race fixed in the next-planets list.
- 3. Shared Mars sky/ground helpers (the farm now uses the rover scenes' code; same pixels): no release needed.
- 5. Zhurong: built as an easter egg, v1.9.8 (agencies and robots were already approved).
- 6. Moon rover drafts: `draft_lunokhod.gif`, `draft_yutu2.gif`, waiting for the user's go-ahead.
- 7. Performance check (390 x 844 phone viewport, CPU slowed 4x): ready in 1.4 s; 95% of frames on time (16.7 ms);
  main thread busy 22% on the map (with or without a passing comet) and 36% on the Martian farm, mostly painting,
  script 4 to 7%. No work needed.
- 4. Meteor "both" draft: `pixel-art/concepts/draft_meteors_both.png`, waiting for the user's choice.
