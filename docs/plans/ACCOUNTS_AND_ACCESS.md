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

## 2. Roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| **Visitor** | anyone, no login | play everything; progress stays in that browser, exactly as today | nothing changes for them; logging in is never required |
| **Player** | a proxy account | read and write **only its own** progress record; load it in any browser | see any other account; change achievements' rules; create accounts |
| **Tester** | a proxy account marked tester | everything a player can, plus reset its own progress and use a test "unlock all" on **its own** record (for checking achievements, see the cheat sheet) | touch other accounts |
| **Admin** | the owner, from a local script on this PC | create, disable and delete proxy accounts, reset their passwords, wipe a record, list accounts | do any of this from the web page: there is no admin page in the browser, so a stolen login can't become an admin |
| **Owner** | med27-coder (GitHub) and its Google account (cloud project), with two-factor sign-in | everything above, billing, deleting the project | - |
| **Machines** | GitHub Actions (optional, to deploy the security rules) | deploy the rules file only | read or write player data |

No moderator role: players can't post anything others see, so there is nothing to moderate.

## 3. Where accounts live: the backend, and your GCP question

The page is static, so accounts need a small service elsewhere. Free options:

| Option | Accounts | Data rules | Cost | Fit |
|---|---|---|---|---|
| **Firebase (part of Google Cloud)** (suggested) | Firebase Authentication (username + password) | Firestore **security rules** | free Spark plan, no billing account, so it can't charge | a local **emulator** runs everything on this PC with fake accounts, ideal for "proxy accounts only"; talks plain HTTPS, so no extra script on the page |
| Supabase | its own auth | Postgres row-level security | free tier (pauses when idle) | good, but its free projects pause after a week unused |
| Cloudflare Workers + D1 | build it ourselves | our own code | free tier | most work; we'd write the login safety ourselves |

**GCP policies: yes, if we choose Firebase, and there are two kinds:**

1. **Cloud IAM (who manages the project).** Owner: only your Google account. No other members. One service account for
   the admin script, with only the roles it needs (Firebase Authentication Admin, Cloud Datastore User), and its key
   kept in `.secrets/` (already git-blocked by the hooks). If GitHub Actions deploys the rules, it signs in through
   Workload Identity Federation (no stored key) with only the Firebase Rules Admin role. Plus an organisation-style
   rule we set by hand: no service-account keys for anything else.
2. **Firestore security rules (who touches which record).** A rules file in the repo (`firebase/firestore.rules`),
   tested on the emulator by CI before it is ever deployed:
   - a player reads and writes `progress/{their own id}` only;
   - a write must look like progress: only the known keys (`eggs`, `ach`, `systems`, ...), dates in the right
     format, under 64 KB;
   - the tester "unlock all" only for accounts the admin marked as testers (a flag the player can't set);
   - nothing else is readable or writable by anyone.

## 4. Proxy accounts

- Names like `PILOT-0001`, each with a long generated password, made by the admin script. No real names or emails.
  Firebase sign-in needs an email-shaped name, so each gets `pilot-0001@accounts.invalid` (`.invalid` is reserved and
  never delivers mail).
- **Public sign-up off**: only the admin script creates accounts (Firebase's "enable create" setting off).
- Admin keeps the list locally (git-ignored); passwords are shown once, never stored in the repo.
- Locked after repeated wrong passwords (Firebase does this); the admin can disable an account at any time.

## 5. How progress loads in another browser

1. Settings gets **LOG IN / LOG OUT** next to the existing backup file buttons (same pixel style, no pop-up windows).
2. On login, the page fetches the account's record and **merges** it with this browser's progress using the existing
   `mergeProgress` (keeps the earliest date of each find, so nothing is ever lost), then saves both.
3. While logged in, changes save to the account a few seconds after they happen, and when the page closes. Offline
   still works: the browser copy carries on and syncs next time.
4. The page talks to Firebase over HTTPS with `fetch` (no Firebase script library), so the strict security policy
   only gains a `connect-src` line for Google's sign-in and Firestore addresses. Every value shown stays escaped.
5. The sign-in token is kept for the session only (decision 5 covers "remember me").

## 6. Privacy and Terms

Records hold only game progress. No analytics, no real identities. Before anything goes online: a short "Accounts"
section in the Terms of Use (version 1.2) and the site's Terms page, and a line in SECURITY.md. Deleting an account
deletes its record.

## 7. Steps

1. **Local only** (nothing online): the emulator, the rules file with its tests in CI, the admin script making five
   proxy accounts and two testers, LOG IN in Settings pointed at the emulator, and browser tests (log in on one
   browser, load the progress on another).
2. **Online** (only after step 1 passes and you say so): a free Firebase project, rules deployed, the page's security
   policy updated, Terms 1.2, released as the next version number.
3. **Roles written down** for the other parts: the GitHub, Hugging Face and key holders tables above go into
   SECURITY.md, plus [COMMIT_IDENTITY.md](COMMIT_IDENTITY.md) (2FA, signed commits).

## 8. Decisions for you

1. **Backend:** Firebase on Google Cloud (suggested), Supabase, or Cloudflare?
2. **Who gets accounts:** only proxy accounts the admin makes (suggested), or open sign-up later?
3. **Local first:** build and test on the emulator only, going online later (suggested), or online straight away?
4. **Testers:** may tester accounts "unlock all" on their own record (suggested), or only reset it?
5. **Remember me:** stay logged in on that browser until LOG OUT (handy), or log out when the tab closes (safer on
   shared computers)?
6. **On LOG OUT:** keep the progress in that browser (suggested), or clear it?
