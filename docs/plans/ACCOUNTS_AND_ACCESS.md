# Plan: accounts and access (IAM) for everything here

**Status: plan only (2 November 2026).** Nothing is built until the user answers the decisions at the end. Goal, in
the user's words: "people just need to log in and their progress loads, in case they want to open up in a different
browser", with **proxy accounts only** (made-up test accounts, no real people's details).

## 1. What exists today

| Part | Who can use it now | How access is controlled |
|---|---|---|
| The star map (GitHub Pages) | anyone | nothing to control: a static page; progress lives only in that browser (`localStorage`, key `starmap.progress.v1`), with a backup file to download and load (Settings, `mergeProgress` in `48-gallery.js`) |
| The Star Gazer demo (`app.py`, Streamlit; optional Hugging Face Space) | anyone who reaches it and ticks the Terms | the Terms gate; one prediction at a time; the Space holds the model key as a secret |
| The GitHub repository | everyone reads; only med27-coder writes | personal repo with no collaborators, the "Protect main" ruleset, push protection, CI tokens read-only by default ([COMMIT_IDENTITY.md](COMMIT_IDENTITY.md)) |
| The encryption key (`.secrets/star_gazer.key`) | the owner's PC (and the Space secret) | never committed (hooks, pre-commit, CI hygiene test) |

So the only new thing is **player accounts for the star map**. Everything else needs its roles written down, not
rebuilt.

## 2. Roles at a glance

| Role | Who | In one line |
|---|---|---|
| **Visitor** | anyone, no login | plays as today; progress stays in that browser |
| **Player** | a proxy account | its own progress, in any browser |
| **Tester** | a proxy account the admin marked tester | a player with a test panel, on its own record only |
| **Admin** | the owner, from a script on this PC | manages accounts; never from the web page |
| **Owner** | med27-coder (GitHub) and its Google account (cloud project), two-factor sign-in | the project itself: who is admin, the rules, deleting everything |
| **Machines** | GitHub Actions | test the rules; optionally deploy them; never see player data |

A role lives in the account's sign-in token (a Firebase "custom claim", `role: player` or `role: tester`), which only
the admin script can set. The page reads it to show or hide buttons; the **server rules** read it to allow or refuse.
No moderator: players can't post anything others see, so there is nothing to moderate.

## 3. What each role can and cannot do

### Visitor (no account)

- Can: everything in the game, the backup file, Settings.
- Cannot: save to the cloud. Logging in is never required.

### Player

| Can | Cannot |
|---|---|
| log in and out in any browser | create accounts, or have more than one |
| read **its own** progress record | read or even list anyone else's |
| save its own progress (merged, nothing lost) | write a record that doesn't look like progress (wrong keys, oversized, bad dates) |
| reset its own progress (deletes its record; the browser copy stays unless they choose otherwise) | delete its account (asks the admin; see 6) |
| change its own password (12 characters or more; decision 7) | rename itself (names are fixed `PILOT-0001` style, so no name needs checking) |
| see its role and account name in Settings | see the test panel, or give itself the tester role |

### Tester (everything a player can, plus a test panel on its own record)

| Can | Cannot |
|---|---|
| **unlock all** achievements and easter eggs (decision 4) | touch any other account's record |
| **lock all** / reset, and unlock one by id (the cheat sheet's list) | turn the test mark off: every save from a tester carries `test: true`, and the rules refuse a tester save without it or a player save with it |
| **pretend clock**: set the date and time the page uses, to check time-of-day and dated achievements (the browser tests already do this) | change a player into a tester or back |
| see sync details (last save time, record size) to check the saving works | exceed the same save limits as players |

Tester records are kept apart from any future statistics by their `test` mark.

### Admin (a script on this PC: `scripts/accounts/admin.py`)

| Command | What it does |
|---|---|
| `create --count N [--tester]` | makes `PILOT-NNNN` accounts with long generated passwords, shown **once** |
| `list` | name, role, created, last sign-in, disabled or not, record size |
| `role NAME player\|tester` | changes the role (takes effect at their next token refresh, within the hour, or at once with `sign-out`) |
| `disable NAME` / `enable NAME` | blocks or restores sign-in; the record is kept |
| `reset-password NAME` | a new generated password, shown once; signs them out everywhere |
| `sign-out NAME` | ends every session of that account at once |
| `export NAME` | the record as a normal backup file (to help a player) |
| `restore NAME FILE` | replaces the record from a backup file the **player** gave |
| `wipe NAME` | deletes the record, keeps the account |
| `delete NAME` | deletes the account and its record |
| `audit [--last N]` | the admin log |

The admin **cannot**: see any password (Firebase keeps only hashes); sign in as a player; edit single achievements
in someone's record (only wipe, or restore from the player's own file); change the server rules (owner, through the
repo); make anyone else an admin (owner, through Cloud IAM). Every admin command writes a log line (time, command,
account, result) to the `audit` collection, which no web page can read or write, and to a git-ignored local log.

### Owner

- The only member of the Google Cloud project (Owner role), with two-factor sign-in.
- The only one who changes the rules (a pull request: CI tests the rules first, then they are deployed).
- Holds the admin script's service-account key in `.secrets/` (git-blocked), and renews it every 90 days.
- Can turn sign-in off for everyone (Firebase setting), and can delete the whole project.

### Machines

- **CI on every push:** runs the rules tests on the emulator (fake project `demo-kepler-star-map`; the `demo-` prefix
  means it cannot reach any real cloud). No cloud access at all.
- **Optional deploy job:** only on `main`, only when `firebase/` changes, only after the tests and a manual approval;
  signs in with Workload Identity Federation (no stored key) and holds only the "Firebase Rules Admin" role.

## 4. Limits

| Limit | Player | Tester | Admin | Enforced by |
|---|---|---|---|---|
| accounts | 1 each | 1 each | - | admin script |
| total accounts | 50 at most | 5 at most of the 50 | - | admin script refuses more |
| how they're made | by the admin only | by the admin only | - | Firebase setting: public sign-up off |
| wrong passwords | blocked for a while after repeated tries | same | can disable the account | Firebase's built-in throttling |
| session | 1-hour token, renewed quietly; ends at LOG OUT, `sign-out`, password reset or disable | same | - | Firebase |
| saves | at most one every 5 seconds (the page waits 10 s after a change, and saves on closing) | same | - | server rules (the page also waits) |
| record contents | only the known progress keys; dates as YYYY-MM-DD; ids up to 40 characters | same plus `test: true` | - | server rules |
| record size | 300 eggs, 300 achievements, 200 systems, 300 viewed, 2,000 calls, 40 outfits, 3 showcase, the seen-stars list up to 80,000 characters: about 150 KB at most (Firestore allows 1 MB) | same | - | server rules (the same caps `mergeProgress` uses) |
| reads | on log in, and when the tab comes back after an hour away | same | - | the page |
| daily budget (free plan) | Firestore allows 50,000 reads and 20,000 writes a day for the whole project; 50 players saving about 100 times a day is 5,000 | - | - | if the budget runs out, saving pauses and the browser copy carries on |

What limits can't do: the page decides what you've earned, so the rules can check that a save **looks right**, not
that it is **true**. With no leaderboards or anything shared, faking only affects your own record. If shared rankings
ever come, they would need checks on the server first.

## 5. How it will work

### Pieces

```text
firebase/
  firebase.json            emulators (sign-in on 9099, Firestore on 8080), project demo-kepler-star-map
  firestore.rules          the server rules (draft below)
  tests/rules.test.mjs     a test for every row of section 3 and 4 (allowed and refused)
  package.json             pinned test tools (firebase-tools, @firebase/rules-unit-testing)
scripts/accounts/admin.py  the admin commands (firebase-admin, its own requirements-accounts file)
web/src/48e-accounts.js    LOG IN / LOG OUT in Settings, the sync, the tester panel
tests/test_accounts.py     admin script against the emulator
tests/test_browser.py      log in, play, log in on a second browser, same progress
```

### Records

| Collection | One per | Holds | Who can read | Who can write |
|---|---|---|---|---|
| `progress/{account id}` | account | the same fields as the browser's saved progress, plus `updatedAt` (server time), `schema: 1`, and `test: true` for testers | that account | that account, within the limits |
| `accounts/{account id}` | account | name, role, created, created by | that account (its own name and role) | admin script only |
| `audit/{id}` | admin command | time, command, account, result | admin script only | admin script only |

### Logging in and syncing

1. The player types `PILOT-0001` and the password. The page signs in over HTTPS (Firebase's sign-in address) and
   gets a 1-hour token carrying the role. No Firebase library is loaded: plain `fetch`, so the strict security policy
   only gains a `connect-src` line for Google's sign-in and Firestore addresses.
2. The page reads `progress/{id}`, merges it with this browser's progress using `mergeProgress` (keeps the earliest
   date of every find, so nothing is lost either way), and saves the result to both places.
3. While logged in, changes save to the account 10 seconds after they happen and when the page closes. Offline still
   works; the next save catches up.
4. Before the token runs out, the page renews it quietly. LOG OUT forgets the tokens (decision 6 covers the browser
   copy).

### Server rules (draft; finished and tested in step 1)

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function role() { return request.auth == null ? '' : request.auth.token.get('role', ''); }
    function owns(uid) { return role() in ['player', 'tester'] && request.auth.uid == uid; }
    function list(d, k, n) { return d.get(k, []) is list && d.get(k, []).size() <= n; }
    function map(d, k, n) { return d.get(k, {}) is map && d.get(k, {}).size() <= n; }
    function looksLikeProgress(d) {
      return d.keys().hasOnly(['eggs', 'ach', 'systems', 'toasts', 'seen', 'viewed', 'finalEmblem', 'whiteHole',
               'calls', 'notified', 'showcase', 'levels', 'sound', 'soundChoice', 'toured', 'daily', 'lastExport',
               'lastStars', 'backdrop', 'outfit', 'outfits', 'astroVisits', 'astroLastRoll', 'astroDry', 'astroDays',
               'comets', 'asteroids', 'ufos', 'meteors', 'model', 'updatedAt', 'schema', 'test'])
        && d.schema == 1 && d.updatedAt == request.time
        && d.get('test', false) == (role() == 'tester')
        && map(d, 'eggs', 300) && map(d, 'ach', 300) && map(d, 'calls', 2000)
        && list(d, 'systems', 200) && list(d, 'viewed', 300) && list(d, 'outfits', 40)
        && list(d, 'showcase', 3) && list(d, 'astroDays', 30) && list(d, 'notified', 3000)
        && d.get('seen', '') is string && d.get('seen', '').size() <= 80000;
    }
    match /progress/{uid} {
      allow read, delete: if owns(uid);
      allow create: if owns(uid) && looksLikeProgress(request.resource.data);
      allow update: if owns(uid) && looksLikeProgress(request.resource.data)
                    && request.time > resource.data.updatedAt + duration.value(5, 's');
    }
    match /accounts/{uid} { allow read: if owns(uid); }
    // everything else, including /audit, is refused to every web page (Firestore's default)
  }
}
```

## 6. Google Cloud policies (if Firebase is chosen)

1. **Cloud IAM (who manages the project):** Owner is only your Google account; no other members. One service account
   for the admin script with only "Firebase Authentication Admin" and "Cloud Datastore User"; no keys for anything
   else. GitHub Actions, if it deploys, uses Workload Identity Federation with only "Firebase Rules Admin".
2. **The web key:** Firebase's web API key is public by design (it identifies the project, it doesn't unlock it), but
   we restrict it to the sign-in and Firestore services and to the GitHub Pages address.
3. **Firestore rules:** section 5; the only door to player data.
4. **The free plan (Spark) with no billing account**, so it can't run up a bill; it stops at the free limits.
5. **Logs:** Cloud Audit Logs record changes to the project's IAM and settings; our `audit` collection records
   admin commands.

## 7. Privacy and Terms

Records hold only game progress. No analytics, no real identities. Before anything goes online: a short "Accounts"
section in the Terms of Use (version 1.2) and the site's Terms page, and a line in SECURITY.md. A player who wants
their account gone asks the admin, who runs `delete` (the record goes with it).

## 8. Steps

1. **Local only** (nothing online): `firebase/` with the emulator, the rules and their tests in CI, the admin script
   making five players and two testers, LOG IN in Settings pointed at the emulator, the tester panel, browser tests.
2. **Online** (only after step 1 passes and you say so): a free Firebase project, rules deployed, the page's security
   policy updated, Terms 1.2, released as the next version number.
3. **Roles written down** for the other parts: section 1's table goes into SECURITY.md, plus
   [COMMIT_IDENTITY.md](COMMIT_IDENTITY.md) (2FA, signed commits).

## 9. Decisions for you

1. **Backend:** Firebase on Google Cloud (suggested), Supabase, or Cloudflare?
2. **Who gets accounts:** only proxy accounts the admin makes (suggested), or open sign-up later?
3. **Local first:** build and test on the emulator only, going online later (suggested), or online straight away?
4. **Testers:** the full test panel (unlock all, lock all, pretend clock) (suggested), or only reset?
5. **Remember me:** stay logged in on that browser until LOG OUT (handy), or log out when the tab closes (safer on
   shared computers)?
6. **On LOG OUT:** keep the progress in that browser (suggested), or clear it?
7. **Passwords:** players may change their own (suggested), or only the admin sets them?
8. **Account cap:** 50 accounts with up to 5 testers (suggested), or other numbers?
