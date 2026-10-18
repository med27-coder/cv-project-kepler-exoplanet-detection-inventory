# Plan: only the med27-coder account can change the project

**Status: research notes, for later** (18 October 2026, user request: "reject any commit that doesn't come from
med27"). Nothing here is built yet.

## Why the author name alone isn't enough

A commit's author name and email are written by whoever makes the commit (`git config user.name/user.email`), so
anyone can type "med27-coder". Checking the author proves nothing on its own. What developers rely on instead:

1. **Who can push.** GitHub only accepts pushes from accounts with write access. A personal repository has one
   owner; with no collaborators added, only med27-coder can push. This is already true, and it is the main lock.
2. **Signed commits.** Each commit is signed with a key tied to the GitHub account (an SSH or GPG key); GitHub shows
   "Verified". A **ruleset with "Require signed commits"** on `main` refuses unsigned pushes. Signing on Windows: an
   SSH key (`git config gpg.format ssh`, `user.signingkey`, `commit.gpgsign true`) added to GitHub as a *signing* key.
3. **Rulesets on `main`**: block force pushes and branch deletion (already set), require the CI `tests` check, and
   optionally restrict commit author emails to the account's no-reply address (a metadata rule; check that it is
   available on this plan before relying on it).
4. **Secret scanning push protection** (Settings, Code security): GitHub blocks a push that contains a recognised
   secret token. It covers known token formats, not the Star Gazer key's own format, so the repo's own CI test
   (`tests/test_repo_hygiene.py`) stays the backstop for that file.
5. **Locally**, the pre-commit hook could also refuse commits whose `user.email` isn't the account's address, as a
   reminder rather than a lock.

## Suggested order

1. Set up an SSH signing key and sign commits (also covers commits made from this PC by Claude Code).
2. Add "Require signed commits" and "Require status checks: tests" to the `main` ruleset.
3. Turn on secret scanning push protection.
4. Optionally the local email check.

Sources: [GitHub: available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets),
[GitHub: about rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).
