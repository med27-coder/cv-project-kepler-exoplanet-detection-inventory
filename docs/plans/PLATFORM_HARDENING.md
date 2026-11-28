# Plan: the platform (landing page, Explorer Registry, security, email, overnight work)

**Status: plan only (27 November 2026).** From a fourth note the user shared, about what an agent should work on
overnight. Its main point, which this plan keeps: **the game layer is already strong; the weak part is the
platform** (first impression, accounts, never losing progress, security, documentation). It builds on
[ACCOUNTS_AND_ACCESS.md](ACCOUNTS_AND_ACCESS.md) and [EXPLORER_JOURNEY.md](EXPLORER_JOURNEY.md).

## 1. The landing page, second version

The preview built on 17 November (`49f-landing.js`, opened with `?landing`) gets the note's structure:

| Section | Content |
|---|---|
| Hero | KEPLER STAR MAP; "Explore 3,600+ worlds from NASA's Kepler mission. Discover planets, earn achievements, call candidates before NASA confirms them, build your explorer journey." Buttons: **START EXPLORING** (no account) and **JOIN THE EXPLORER REGISTRY** |
| Four feature cards | EXPLORE WORLDS, MAKE PREDICTIONS, EARN ACHIEVEMENTS, YOUR CAPTAIN'S LOG (pixel icons, not emoji) |
| Your explorer so far | the visitor's own rank, achievements, systems visited and prediction record, read from this browser's progress (a guest sees their real numbers; a first-time visitor sees the starting point) |
| Your discoveries belong to you | local backup, export any time, no ads, no tracking; **cloud sync** marked "coming" until it is online |
| What is saved, how it is protected | as now |
| Star Gazer, the guide | as now |

Every claim stays literally true on the day it ships.

## 2. The Explorer Registry (the accounts, presented as optional)

Decided already (ACCOUNTS_AND_ACCESS section 10): Supabase Auth, open sign-up, names and passwords, no email,
local first. The note's **why register** list goes on the sign-up form: keep your discoveries, carry them to any
device, keep your predictions, build your explorer profile. "Unlock future community features" is left out until
such features are planned.

## 3. The note's security checklist, against what exists

| The note asks for | Status here |
|---|---|
| no home-made authentication (Auth.js or Supabase Auth) | **done**: Supabase Auth |
| login rate limits | **done**: Supabase's limit on sign-ins and sign-ups per address (20 per 5 minutes, `supabase/config.toml`; can go lower) plus its lockout |
| API rate limits | **writes done**: one save per 5 seconds per account (`limits.save_gap`), checked in the database. Reads are small and own-account only; a per-account read limit can come with going online |
| input validation, "no raw input reaches the database" | **done**: players write only through database functions that check every field (`save_progress` and friends), plus table checks; 44 tests |
| CSRF protection, HttpOnly / Secure / SameSite cookies | **not applicable**: the static page sends the sign-in token in a request header, not a cookie, so there is nothing for a forged request to ride on. The real risk is a script stealing the token, which the strict security policy and escaping everything guard against |
| Argon2 password hashes | Supabase stores bcrypt hashes, also a standard; we never see passwords either way |
| encrypt emails and sensitive metadata | **nothing to encrypt**: no emails or real details are stored |
| universe data apart from explorer data | **done** |
| email verification, password reset by email | **no email** (decided): the owner resets a forgotten password on request; the sign-up form says so |
| MFA ready | Supabase supports authenticator-app codes; planned for the owner before going online |

Still to write: a **threat model** (who might attack what, and what stops them), **sequence diagrams** (sign up,
sign in, save, merge, delete), and a **go-online checklist** (keys, security policy, Terms 1.2, backups).

## 4. Email (the note's biggest new idea) and its clash with "no email"

The note suggests welcome emails, a weekly transmission, prediction-settled emails and daily-mystery reminders,
through Resend with double opt-in, plus three tables (subscribers, notification preferences, an email log).

This conflicts with the decision that accounts hold **no email**, and with the landing page's "No email" promise.
Two ways forward (decision 1):

- **A. Transmissions in the game, no email** (suggested now): the antenna becomes an inbox. It already announces
  each version; it would also hold "NASA ruled on your call: correct" (today a pop-up), new easter eggs available,
  and the daily mystery. Notification preferences become settings (which transmissions to show). Nothing leaves the
  site, and the privacy promise stays simple.
- **B. Optional email for updates only:** a separate, opt-in list with double opt-in (Resend), an unsubscribe link
  in every email, email kept apart from the account, and the landing page, Terms and privacy text changed to say so.
  Possible later; it needs a sending domain and a decision to hold real addresses.

## 5. Architecture: what the note suggests, and what this project uses

| The note | Here | Why |
|---|---|---|
| Next.js frontend | the static site as it is | a rewrite would risk the game for no gain; it already loads fast, works offline and runs under a strict security policy |
| Cloudflare in front | GitHub Pages (already a CDN with HTTPS) | can be added later if traffic ever needs it |
| Kepler API | Supabase's API with our database functions | no server code of our own to keep secure |
| PostgreSQL | Supabase Postgres | done |
| Redis | none | nothing to cache or queue at this size |
| background workers | GitHub Actions (the monthly NASA refresh and rulings); a scheduled job could later send in-game transmissions | already runs |
| Docker: web, api, worker, postgres, redis, ai-guide | for local work: Supabase's containers plus the `docker-setup` branch's web and Star Gazer containers | waits on the question about that branch |

## 6. Overnight work: what an unattended agent may do

Safe without the user (all local, tested, nothing goes online, no new decisions): the queue in
[LOOP_BACKLOG.md](LOOP_BACKLOG.md), section "Platform queue (27 November)".

Never unattended: going online, pushing the history rewrite, anything with email or new sign-in providers, choosing
between the open decisions, merging someone else's branch.

## 7. Decisions for you

1. **Email:** transmissions in the game only (suggested), or an optional email list later?
2. **Landing page:** the second version above (suggested), including your own stats on it?
3. **Overnight:** let an agent work the platform queue unattended (`/loop` on LOOP_BACKLOG.md)?
